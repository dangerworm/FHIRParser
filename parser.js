const { randomUUID } = require("crypto");
const fs = require("fs");
const data = fs.readFileSync("data.json");
const message = JSON.parse(data);

const config = {
    "parsed": {
        "ServiceRequest": {
            "Patient ID": {
                "Path": "subject.identifier.value"
            },
            "Organisation": {
                "Path": "performer.0.identifier.value",
                "Prefix": "org:"
            },
            "Tests": {
                "Path": "code.coding.*.code",
                "Suffix": " (SNOMED)"
            }
        },
        "PractitionerRole": {
            "SDS User ID": {
                "Path": "practitioner.identifier.value",
            },
            "Practitioner Name": {
                "Path": "practitioner.display"
            }
        }
    },
    "static": {
        "Entity": "request:<guid>",
        "Output": "Test Report",
        "Status": "Requested"
    }
};

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
            const { Path: path, Prefix: prefix, Suffix: suffix } = propertyPaths[propertyName]

            console.log(path)
            const keys = path.split('.');
            const value = getParsedValue(data[resourceType], keys);

            result[propertyName] = prefix
                ? `${prefix}${value}${suffix}`
                : value;
        })
    });

    Object.keys(config.static).forEach(propertyName => {
        result[propertyName] = getStaticValue(config.static[propertyName]);
    });

    return result;
}

console.log(getData(message, config))