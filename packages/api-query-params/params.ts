type CasterFn = (val: any, flags?: string) => any;

interface Casters {
  [key: string]: CasterFn;
}

interface Options {
  casters?: Casters;
  castParams?: Record<string, keyof Casters>;
  blacklist?: string[];
  whitelist?: string[];
  [key: string]: any; // để fallback cho các key khác như populationKey, projectionKey,...
}

interface UnaryValues {
  plus: number;
  minus: number;
}

interface Projection {
  [field: string]: number;
}

interface Population {
  path: string;
  select?: Projection;
  populate?: Population;
}

interface AQPResult {
  population?: Population[];
  projection?: Projection;
  sort?: Record<string, number>;
  skip?: number;
  limit?: number;
  filter?: Record<string, any>;
}

const builtInCasters: Casters = {
  boolean: (val: string) => val === 'true',
  date: (val: string) => new Date(val),
  null: () => null,
  number: (val: string) => Number(val),
  regex: (val: string, flags?: string) => new RegExp(val, flags),
  string: (val: string) => String(val),
};

const parseValue = (value: string, key: string, options: Options): any => {
  const casters = { ...builtInCasters, ...options.casters };
  const castersList = Object.keys(casters).join('|');
  const castersRegexp = new RegExp(`^(${castersList})\\(([^)]*)\\)$`);
  const casting = value.match(castersRegexp);
  if (casting && casters[casting[1]]) {
    return casters[casting[1]](casting[2]);
  }

  const regexes = value.match(/\/.*?\/(?:[igm]*)/g);
  const parts = regexes || value.split(',');
  if (parts && parts.length > 1) {
    return parts.map((part) => parseValue(part, key, options));
  }

  if (
    options.castParams &&
    options.castParams[key] &&
    casters[options.castParams[key]]
  ) {
    return casters[options.castParams[key]]!(value);
  }

  const regex = value.match(/^\/(.*)\/([igm]*)$/);
  if (regex) {
    return casters.regex(regex[1], regex[2]);
  }

  if (value === 'true' || value === 'false') {
    return casters.boolean(value);
  }

  if (value === 'null') {
    return casters.null(value);
  }

  if (
    !Number.isNaN(Number(value)) &&
    Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER &&
    !/^0[0-9]+/.test(value)
  ) {
    return casters.number(value);
  }

  const date = value.match(
    /^[12]\d{3}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)(T| )?(([01][0-9]|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/
  );
  if (date) {
    return casters.date(value);
  }

  return casters.string(value);
};

const parseOperator = (operator: string): string => {
  switch (operator) {
    case '=': return '$eq';
    case '!=': return '$ne';
    case '>': return '$gt';
    case '>=': return '$gte';
    case '<': return '$lt';
    case '<=': return '$lte';
    default: return '$exists';
  }
};

const parseUnaries = (
  unaries: string | string[],
  values: UnaryValues = { plus: 1, minus: -1 }
): Record<string, number> => {
  const unariesAsArray = typeof unaries === 'string' ? unaries.split(',') : unaries;
  return unariesAsArray
    .map((unary) => unary.match(/^(\+|-)?(.*)/) as RegExpMatchArray)
    .reduce((result, [, val, key]) => {
      result[key.trim()] = val === '-' ? values.minus : values.plus;
      return result;
    }, {} as Record<string, number>);
};

const parseJSONString = (string: string): any | false => {
  try {
    return JSON.parse(string);
  } catch {
    return false;
  }
};

const getProjection = (projection: string): Projection => {
  const fields =
    parseJSONString(projection) ||
    parseUnaries(projection, { plus: 1, minus: 0 });

  const hasMixedValues =
    Object.keys(fields).reduce((set, key) => {
      if (key !== '_id' && (fields[key] === 0 || fields[key] === 1)) {
        set.add(fields[key]);
      }
      return set;
    }, new Set()).size > 1;

  if (hasMixedValues) {
    Object.keys(fields).forEach((key) => {
      if (fields[key] === 1) {
        delete fields[key];
      }
    });
  }

  return fields;
};

const getPopulation = (population: string): Population[] => {
  const cache: Record<string, Population> = {};

  function iterateLevels(levels: string[], prevLevels: string[] = []): Population {
    let populate: Population | undefined;
    let path: Population;
    const topLevel = levels.shift()!;
    prevLevels.push(topLevel);

    const cacheKey = prevLevels.join('.');
    if (cache[cacheKey]) {
      path = cache[cacheKey];
    } else {
      path = { path: topLevel };
    }
    cache[cacheKey] = path;

    if (levels.length) {
      populate = iterateLevels(levels, prevLevels);
      if (populate) {
        path.populate = populate;
      }
    }
    return path;
  }

  const populations = population.split(',').map((path) => {
    return iterateLevels(path.split('.'));
  });

  return [...new Set(populations)];
};

const getSort = (sort: string) => parseUnaries(sort);
const getSkip = (skip: string) => Number(skip);
const getLimit = (limit: string) => Number(limit);

const parseFilter = (filter: string | object): any => {
  if (typeof filter === 'object') {
    return filter;
  }

  const jsonFilter = parseJSONString(filter);
  if (jsonFilter) {
    return jsonFilter;
  }

  throw new Error(`Invalid JSON string: ${filter}`);
};

const getFilter = (filter: string | object | undefined, params: Record<string, any>, options: Options): any => {
  const parsedFilter = filter ? parseFilter(filter) : {};
  return Object.keys(params)
    .map((val) => {
      const join = params[val] ? `${val}=${params[val]}` : val;
      const [, prefix, key, op, value] = join.match(/(!?)([^><!=]+)([><]=?|!?=|)(.*)/)!;
      return {
        prefix,
        key,
        op: parseOperator(op),
        value: parseValue(value, key, options),
      };
    })
    .filter(
      ({ key }) =>
        options.blacklist!.indexOf(key) === -1 &&
        (!options.whitelist || options.whitelist.indexOf(key) !== -1)
    )
    .reduce((result, { prefix, key, op, value }) => {
      if (!result[key]) {
        result[key] = {};
      } else if (typeof result[key] === 'string') {
        result[key] = { $eq: result[key] };
      }

      if (Array.isArray(value)) {
        result[key][op === '$ne' ? '$nin' : '$in'] = value;
      } else if (op === '$exists') {
        result[key][op] = prefix !== '!';
      } else if (op === '$eq' && Object.entries(result[key]).length === 0) {
        result[key] = value;
      } else if (op === '$ne' && typeof value === 'object' && value !== null) {
        result[key].$not = value;
      } else {
        result[key][op] = value;
      }

      return result;
    }, parsedFilter);
};

const mergeProjectionAndPopulation = (result: AQPResult) => {
  function iteratePopulation(population: Population[], prevPrefix = '') {
    population.forEach((row) => {
      const prefix = `${prevPrefix}${row.path}.`;
      if (result.projection) {
        Object.keys(result.projection).forEach((key) => {
          if (key.startsWith(prefix)) {
            const unprefixedKey = key.replace(prefix, '');
            if (unprefixedKey.indexOf('.') === -1) {
              row.select = {
                ...row.select,
                [unprefixedKey]: result.projection![key],
              };
              delete result.projection![key];
            }
          }
        });
      }
      if (row.populate) {
        iteratePopulation([row.populate], prefix);
      }
    });
  }

  if (result.projection && result.population) {
    iteratePopulation(result.population);
  }
};

const operators = [
  { operator: 'population', method: getPopulation, defaultKey: 'populate' },
  { operator: 'projection', method: getProjection, defaultKey: 'fields' },
  { operator: 'sort', method: getSort, defaultKey: 'sort' },
  { operator: 'skip', method: getSkip, defaultKey: 'skip' },
  { operator: 'limit', method: getLimit, defaultKey: 'limit' },
  { operator: 'filter', method: getFilter, defaultKey: 'filter' },
];

const aqp = (query: string | Record<string, any> = '', options: Options = {}): AQPResult => {
  const result: AQPResult = {};
  let params: Record<string, any>;

  if (typeof query === 'string') {
    params = {};
    const urlSearchParams = new URLSearchParams(query);
    for (const [key, value] of urlSearchParams.entries()) {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value);
        } else {
          params[key] = [params[key], value];
        }
      } else {
        params[key] = value;
      }
    }
  } else {
    params = query;
  }

  options.blacklist = options.blacklist || [];

  operators.forEach(({ operator, method, defaultKey }) => {
    const key = options[`${operator}Key`] || defaultKey;
    const value = params[key];
    options.blacklist!.push(key);

    if (value || operator === 'filter') {
      (result as any)[operator] = method(value, params, options);
    }
  });

  mergeProjectionAndPopulation(result);

  return result;
};

export default aqp;
