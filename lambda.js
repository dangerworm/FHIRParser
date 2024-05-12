import { randomUUID } from "crypto";

const getResources = (data) => {
  const resourceTypes = data.entry
    .map(entry => entry.resource.resourceType)
    .filter((value, index, array) => array.indexOf(value) === index);

  const resources = {}
  resourceTypes.forEach(resourceType => resources[resourceType] = []);
  data.entry.forEach(entry => resources[entry.resource.resourceType].push(entry.resource));

  return resources;
};

const getParsedValue = (obj, keys) => {
  if (keys.length === 0) {
    return obj;
  }

  const key = keys.shift();
  if (key === '*') {
    return obj.map(item => getParsedValue(item, keys));
  }

  return isNaN(parseInt(key))
    ? getParsedValue(obj[key], keys)
    : getParsedValue(obj[parseInt(key)], keys);
}

const getStaticValue = (input) => {
  const replacement = input.match(/.*(<\w+>).*/);

  if (replacement === null) {
    return input;
  }

  if (replacement[1] === '<guid>') {
    return input.replace(/<\w+>/, randomUUID());
  }
}

const getData = (message, config) => {
  const resources = getResources(message);
  
  const data = {}
  Object.keys(config.parsed).forEach(resourceType => {
    let resource = resources[resourceType];
    if (Array.isArray(resource)) {
      resource = resource[0];
    }

    data[resourceType] = resource;
  });
  
  const result = {}
  Object.keys(config.parsed).forEach(resourceType => {
    const propertyPaths = config.parsed[resourceType];
    Object.keys(propertyPaths).forEach(propertyName => {
      const [prefix, keyString] = propertyPaths[propertyName].includes("|")
        ? propertyPaths[propertyName].split('|')
        : ["", propertyPaths[propertyName]];

      const keys = keyString.split('.');
      const value = getParsedValue(data[resourceType], keys);

      result[propertyName] = prefix
        ? `${prefix}${value}`
        : value;
    })
  });

  Object.keys(config.static).forEach(propertyName => {
    result[propertyName] = getStaticValue(config.static[propertyName]);
  });

  return result;
}

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  let body;
  let statusCode = '200';

  const { message, config } = event;

  if (message === undefined) {
    body = "Property 'message' was not present in event input";
    statusCode = '400';
  }
  else if (config === undefined) {
    body = "Property 'config' was not present in event input";
    statusCode = '400';
  }

  try {
    body = getData(message, config);
  } catch (err) {
    body = err.message;
    statusCode = '400';
  } finally {
    body = JSON.stringify(body);
  }

  return {
    body,
    headers,
    statusCode
  };
};
