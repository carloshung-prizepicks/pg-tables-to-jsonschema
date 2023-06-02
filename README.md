# pg-tables-to-jsonschema

[![NPM version](https://badge.fury.io/js/pg-tables-to-jsonschema.png)](http://badge.fury.io/js/pg-tables-to-jsonschema)

[![Npm Downloads](https://nodei.co/npm/pg-tables-to-jsonschema.png?downloads=true&stars=true)](https://nodei.co/npm/pg-tables-to-jsonschema.png?downloads=true&stars=true)

---

This utility was modified to output JSON Schemas and JSON API Schemas from Postgresql tables.

# The PrizePicks way


## How to run it locally

### Prerequisite
* Install `node` using `nvm` if you haven't already, see [Install Node.js Locally with Node Version Manager (nvm)](https://heynode.com/tutorial/install-nodejs-locally-nvm/)

### Setup
* Run `npm install` and explicitly install the _pg-structure_ package
  ```
  $ npm install
  $ npm install pg-structure
  ```

### Update config file, predict -picks-dev-config.json
1. Add your local DB credentials
   ```
   "pg": {
     "host": "localhost",
     "database": "predict-picks-dev",
     "user": "postgres",
     "password": "root"
   },
   ```
2. Add DB table(s) to generate the below schemas for
   - JSON (standard)
   - JSON API
   - JSON API Collection
   - Rswag Ruby Hash
   - Rswag Collection Ruby Hash

  * For example:
    ```
    "input": {
      "schemas": ["public"],
      "exclude": [],
      "include": ["projections"]
    },
    ```
    * The utility (see next section) will generate these files in `<proj root>/json_schemas/public`
        projections.json
        projections-api.json
        projections-list-api.json
        projections-rswag.rb
        projections-list-rswag.rb

### Usage (run it this way)
* Run app, *pg-tables-to-jsonschema*. The **preferred** (recommended) option is to use a config file as follows:
  ```
  $ node ./lib/cli.js --config ./predict-picks-dev-config.json
  ```

* Use help to show options
  ```
  $ node ./lib/cli.js --help
  ```

#### For example

Do `cd <path_to_this_repo_root>`
For the below config `./predict-picks-dev-config.json` which generates all `projections` json schema formats: _model_, _swag_, and _response data_ for both a _projection_ model or list:

```
{
  "pg": {
    "host": "localhost",
    "database": "predict-picks-dev",
    "user": "postgres",
    "password": "root"
  },
  "input": {
    "schemas": ["public"],
    "exclude": [],
    "include": ["projections"]
  },
  "output": {
    "additionalProperties": false,
    "baseUrl": "",
    "defaultDescription": "",
    "indentSpaces": 2,
    "outDir": "json-schemas",
    "unwrap": false
  }
}
```
When we invoke `node ./lib/cli.js --config ./predict-picks-dev-config.json`, it will generate in `./json-schemas/public`:

| File name                  | Description                           |
| :---                       | :---                                  |
| projections.json           | model schema                          |
| projections-swag.rb        | model schema for swagger              |
| projections-list-swag.rb   | model list schema for swagger         |
| projections-list-api.json  | model serializer response schema      |
| projections-api.json       | model list serializer response schema |

---
### A continuation is the Original README

A command-line utility and module to turn postgresql tables into JSON Schemas. Uses [pg-structure](https://www.pg-structure.com) for the table to json conversion.

I wrote this module because I have a set of REST-like APIs using JSON Schema for their input and output validation. The tables provide the low level data interchange formats I use throughout my code. So pairing this with my other [jsonschema-to-typings](https://www.npmjs.com/package/jsonschema-to-typings) utility gives me both code completion and hinting alongside jsonschema based validation.

DISCLAIMER: I wrote this module to fit my specific project needs. I may have missed a few column types. Also complex types like arrays and geo-spatial data have not been added. Feel free to fork or add pull requests for anything you are missing

UPDATE: I've now released version 1.0.0 which doesn't break previous APIs and features but is a pretty big refactor. Switched to pg-structure and typescript and now supporting config based conversion.

## Command-line usage

```javascript
pgtables2jsonschema --pg-host localhost --pg-user admin --pg-password secret --pg-database my-db --pg-schema my_schema -b 'http://yourhost/schema/' -o test/
```

Calling with -h will provide you with all the possible options:

```bash
Usage: cli [options]

  Options:

    -V, --version                 output the version number
    -c, --config                  Path to configuration file. Additional parameters override config values
    --pg-host <value>             The postgresql host to connect to
    --pg-port <n>                 The postgresql host to connect to. Defaults to 5432
    --pg-database <value>         The postgresql database to connect to
    --pg-user <value>             The postgresql user to login with
    --pg-password <value>         The postgresql password to login with
    --pg-schema <value>           The postgresql schema to convert
    -i, --indent [size]           The indent size in spaces. Default: 2
    -o, --out [file]              Output folder. Default output is to STDOUT only JSON schema. JSON API and rswag schemas are
                                  written to file. A sub-folder will be created per schema
    -b, --base-url [url]          The optional base url for the schema id
    -p, --additional-properties   Allow additional properties on final schema. Set option to allow properties. Default: false
    -t, --include-tables <value>  Comma separated list of tables to process. Default is all tables found
    -e, --exclude-tables <value>  Comma separated list of tables to exclude. Default is to not exclude any
    -u, --unwrap                  Unwraps the schema if only 1 is returned
    -h, --help                    output usage information
```

You can find an [example configuration](example-config.json) in this repository.

## Code usage

You can use the schema converter module as follows:

```javascript
var converter = require( "pg-tables-to-jsonschema" );

// Schemas is an array of json-schema objects
//
const schemas = await converter( {
  pg: {
    host: 'localhost',
    port: 5432,
    user: 'admin',
    password: 'secret'
    database: 'db_name',
  },
  input: {
    schemas: ['public', 'stuff'],
    exclude: ['not_this_table'],
    include: []
  },
  output: {
    additionalProperties: false,
    baseUrl: 'http://api.localhost.com/schema/',
    defaultDescription: 'Missing description',
    indentSpaces: 2,
    outDir: 'dist/schema',
    unwrap: false
  }
} );
```
