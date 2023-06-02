import { promises, constants } from 'fs';
import { join } from 'path';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import jsonfile from 'jsonfile';
import mkdirp from 'mkdirp';
import pgStructure, { Column, Entity, Schema } from 'pg-structure';
import { IConfiguration } from './config';
import * as fs from 'fs';

export class SchemaConverter {

  /**
   * Creates an instance of SchemaConverter
   *
   * @param {IConfiguration} config The configuration for the database, input and output
   */
  constructor( private config: IConfiguration ) {
  }

  /**
   * This helper method will check if the provided configuration is usable
   *
   * @returns {Promise<undefined>}
   */
  public async checkConfiguration(): Promise<undefined> {
    if ( !this.config ) {
      throw new Error('No configuration supplied');
    }

    if ( !this.config.pg?.host || !this.config.pg?.database || !this.config.pg?.user ) {
      throw new Error( 'Missing PGSQL config' );
    }

    if ( this.config.output?.outDir ) {
      // Create the folder and sub-paths if missing
      //
      await mkdirp( this.config.output.outDir );

      // Check the output folder is writeable
      //
      try {
        await promises.access(this.config.output.outDir, constants.W_OK );
      } catch (err) {
        console.error(err);
        throw new Error(`Cannot write to ${this.config.output.outDir}`)
      }
    }

    return;
  }

  /**
   * Perform the actual conversion process and output generated schemas
   * If an `outDir` is configured we will write to file instead.
   * This would be preferred for memory intensive conversion with many or very
   * large schemas
   *
   * @returns {(Promise<JSONSchema7[]>)}
   */
  public async convert(): Promise<JSONSchema7[]> {
    // Ensure configuration is sane first
    //
    await this.checkConfiguration();

    // Connect to the database using pgStructure
    // Will throw on error
    //
    console.warn('Connecting to database...');
    const dbSchemas = this.config.input?.schemas || ['public'];
    const db = await pgStructure(
      {
        database: this.config.pg.database,
        host: this.config.pg.host,
        port: this.config.pg.port,
        user: this.config.pg.user,
        password: this.config.pg.password,
      },
      {
        includeSchemas: dbSchemas,
        includeSystemSchemas: true,
      },
    )

    // Prepare the inclusion and exclusion lists
    //
    const includedEntities = this.config.input?.include || [];
    const excludedEntities = this.config.input?.exclude || [];

    // Prepare some output settings
    //
    const outputFolder = this.config.output?.outDir;
    const indentSpaces = this.config.output?.indentSpaces === undefined ? 2 : this.config.output.indentSpaces;
    const defaultDescription = this.config.output?.defaultDescription || `${new Date()}`;
    const additionalProperties = this.config.output?.additionalProperties === true;
    const baseUrl = (this.config.output?.baseUrl || '').replace(/\/$/, '');

    const outputSchemas: JSONSchema7[] = [];

    // Iterate all the schemas
    //
    for (const dbSchema of dbSchemas) {
      console.warn(`Processing schema ${dbSchema}`);
      const schema = db.get(dbSchema) as Schema;
      const schemaName = schema.name;

      // Process all the tables in the schema
      //
      for (const table of schema.tables) {
        const tableName = table.name;

        // Check if the entity is included and/or excluded
        //
        if (
          excludedEntities.indexOf(tableName) === -1 &&
          (includedEntities.length === 0 || includedEntities.indexOf(tableName) !== -1)
        ) {
          console.warn(`Processing table ${tableName}`);
          const jsonSchema = await this.convertEntity( {
            additionalProperties,
            baseUrl,
            defaultDescription,
            indentSpaces,
            outputFolder,
            schemaName,
            entity: table,
          });

          outputSchemas.push(jsonSchema);
        } else {
          console.warn(`Skipping excluded table ${tableName}`);
        }
      }

      // Process all the views in the schema
      //
      for (const view of schema.views) {
        const viewName = view.name

        // Check if the entity is included and/or excluded
        //
        if (
          excludedEntities.indexOf(viewName) === -1 &&
          (includedEntities.length === 0 || includedEntities.indexOf(viewName) !== -1)
        ) {
          console.warn(`Processing view ${viewName}`);
          const jsonSchema = await this.convertEntity( {
            additionalProperties,
            baseUrl,
            defaultDescription,
            indentSpaces,
            outputFolder,
            schemaName,
            entity: view,
          });

          outputSchemas.push(jsonSchema);
        }
      }

      // Process all the materialized views in the schema
      //
      for (const view of schema.materializedViews) {
        const viewName = view.name

        // Check if the entity is included and/or excluded
        //
        if (
          excludedEntities.indexOf(viewName) === -1 &&
          (includedEntities.length === 0 || includedEntities.indexOf(viewName) !== -1)
        ) {
          console.warn(`Processing materialized view ${viewName}`);
          const jsonSchema = await this.convertEntity( {
            additionalProperties,
            baseUrl,
            defaultDescription,
            indentSpaces,
            outputFolder,
            schemaName,
            entity: view,
          });

          outputSchemas.push(jsonSchema);
        }
      }
    }

    return outputSchemas;
  }

  /**
   * Helper method that converts an Entity to a JSON Schema
   *
   * @private
   * @param {{
   *       additionalProperties: boolean,
   *       baseUrl: string,
   *       defaultDescription: string,
   *       indentSpaces: number,
   *       outputFolder?: string,
   *       entity: Entity,
   *     }} {
   *       additionalProperties,
   *       baseUrl,
   *       defaultDescription,
   *       indentSpaces,
   *       outputFolder,
   *       entity,
   *     }
   * @returns
   */
  private async convertEntity(
    {
      additionalProperties,
      baseUrl,
      defaultDescription,
      indentSpaces,
      outputFolder,
      schemaName,
      entity,
    }: {
      additionalProperties: boolean,
      baseUrl: string,
      defaultDescription: string,
      indentSpaces: number,
      outputFolder?: string,
      schemaName: string,
      entity: Entity,
    }
  ) {
    const entityName = entity.name;
    const baseName = entityName.replace( `${schemaName}_`, '' );
    const jsonSchema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft/schema#',
      $id: `${entityName}.json`,
      title: baseName,
      type: 'object',
      required: [],
      properties: {},
    };

    // define json api schema
    const jsonApiSchema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft/schema#',
      $id: `${entityName}.json`,
      title: baseName,
      type: 'object',
      required: [ 'data' ],
      properties: {
        data: {
        }
      }
    };

    // define json api list schema
    const jsonApiListSchema = Object.assign({}, jsonApiSchema);

    const columns = entity.columns;
    for (const column of columns) {
      const columnName = column.name;
      const columnType = column.type.name;

      (jsonSchema.properties as {[key: string]: JSONSchema7Definition})[columnName] = {
        ...this.convertColumnType({ column }) as Record<string, unknown>,
        ...this.convertDefaultValue({ column }) as Record<string, unknown>,
        maxLength: column.length,
      };

      // Check if the column is required
      //
      if (column.notNull) {
        (jsonSchema.required as string[]).push(columnName);
      }
    }

    const jsonApiObjectSchema: any = {
      type: 'object',
      required: [ 'id', 'type', 'attributes' ],
      properties: {
        id: {
          type: 'string',
          format: 'number'
        },
        type: {
          type: 'string',
          enum: [ this.convertPlurarlToSingularWord(baseName) ]
        },
        attributes: {
          type: 'object',
          required: jsonSchema.required,
          properties: jsonSchema.properties
        }
      }
    };

    // Set json api schema
    (jsonApiSchema.properties as {[key: string]: JSONSchema7Definition})['data'] = jsonApiObjectSchema;

    // Set json api list schema
    (jsonApiListSchema.properties as {[key: string]: JSONSchema7Definition})['data'] = {
      type: 'array',
      items: [ jsonApiObjectSchema ]
    };

    // Write to file if requested
    //
    if (outputFolder) {
      const folderName = join(outputFolder, schemaName);
      await mkdirp(folderName);

      let fileName = join(folderName, `${entityName}.json`);
      await jsonfile.writeFile(fileName, jsonSchema, { spaces: indentSpaces });

      fileName = join(folderName, `${entityName}-api.json`);
      await jsonfile.writeFile(fileName, jsonApiSchema, { spaces: indentSpaces });

      fileName = join(folderName, `${entityName}-swag.rb`);
      const rubyHash = this.convertJsonToRubyHash(jsonApiSchema, indentSpaces) + '\n';
      await fs.writeFileSync(fileName, rubyHash);

      fileName = join(folderName, `${entityName}-list-api.json`);
      await jsonfile.writeFile(fileName, jsonApiListSchema, { spaces: indentSpaces });

      fileName = join(folderName, `${entityName}-list-swag.rb`);
      const rubyListHash = this.convertJsonListToRubyHash(jsonApiListSchema, indentSpaces);
      await fs.writeFileSync(fileName, rubyHash);
    }

    return jsonSchema;
  }

  /**
   * Helper method to convert a postgresql column type to a json-schema type
   * and format
   *
   * @private
   * @param {{
   *       column: Column,
   *     }} {
   *       column,
   *     }
   * @returns {Partial<JSONSchema7Definition>}
   */
  private convertColumnType(
    {
      column,
    } : {
      column: Column,
    }
  ) : JSONSchema7Definition {
    const columnType = column.type.name;
    const isArray = column.arrayDimension > 0;

    switch(columnType) {
      case 'bit':
      case 'bit varying':
      case 'varbit':
      case 'character':
      case 'character varying':
      case 'text':
      {
        const typeDef: JSONSchema7Definition = { type: 'string', maxLength: column.length };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['string', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'uuid':
      {
        const typeDef: JSONSchema7Definition = { type: 'string', format: 'uuid', maxLength: column.length };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['string', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'date':
      {
        const typeDef: JSONSchema7Definition = { type: 'string', format: 'date', maxLength: column.length };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['string', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'time with time zone':
      case 'time without time zone':
      {
        const typeDef: JSONSchema7Definition = { type: 'string', format: 'time', maxLength: column.length };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['string', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'timestamp with time zone':
      case 'timestamp without time zone':
      case 'timestamp':
      {
        const typeDef: JSONSchema7Definition = { type: 'string', format: 'date-time', maxLength: column.length };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['string', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'boolean':
      {
        const typeDef: JSONSchema7Definition = { type: 'boolean' };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['boolean', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'bigint':
      case 'decimal':
      case 'double precision':
      case 'float8':
      case 'int':
      case 'integer':
      case 'numeric':
      case 'real':
      case 'smallint':
      {
        const typeDef: JSONSchema7Definition = { type: 'number', maxLength: column.length };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['number', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'json':
      case 'jsonb':
      {
        const typeDef: JSONSchema7Definition = { type: 'object', properties: {} };
        if (!column.notNull && column.default == null) {
          typeDef['type'] = ['object', 'null'];
        }
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      case 'interval':
      {
        const typeDef: JSONSchema7Definition = {
          oneOf: [
            {
              type:         'number',
              description:  'Duration in seconds'
            },
            {
              type:         'string',
              description:  'Descriptive duration i.e. 8 hours'
            },
            {
              type:         'object',
              description:  'Duration object',
              properties: {
                years:        { type: 'number' },
                months:       { type: 'number' },
                days:         { type: 'number' },
                hours:        { type: 'number' },
                minutes:      { type: 'number' },
                seconds:      { type: 'number' },
                milliseconds: { type: 'number' }
              }
            },
          ]
        };
        if (isArray) {
          return { type: 'array', items: typeDef };
        }
        return typeDef;
      }

      default:
      {
        console.warn(`Unsupported column type: ${columnType}. Defaulting to null` );
        return { type: 'null' };
      }
    }
  }

  /**
   * Helper method to convert a postgresql column default to a json-schema default value
   * and format
   *
   * @private
   * @param {{
   *       column: Column,
   *     }} {
   *       column,
   *     }
   * @returns {Partial<JSONSchema7Definition>}
   */
  private convertDefaultValue(
    {
      column,
    } : {
      column: Column,
    }
  ) : JSONSchema7Definition {
    const columnType = column.type.name;
    const isArray = column.arrayDimension > 0;
    let defaultValue = column.default;

    const defaultDef: JSONSchema7Definition = { default: undefined };
    if (column.notNull) {
      return defaultDef;
    }

    if (defaultValue != null) {
      switch(columnType) {
        case 'json':
        case 'jsonb':
        case 'interval':
          defaultDef['maxLength'] = column.length;
          break;
        case 'boolean':
          defaultDef['maxLength'] = column.length;
          defaultValue = !!column.default;
          break;
        case 'bigint':
        case 'decimal':
        case 'double precision':
        case 'float8':
        case 'int':
        case 'integer':
        case 'numeric':
        case 'real':
        case 'smallint':
          defaultValue = +defaultValue;
          break;
        default:
          defaultValue = null;
          break;
      }
    }

    defaultDef['default'] = defaultValue;
    return defaultDef;
  }

  // convert json to ruby hash with indentation
  private convertJsonToRubyHash(json: any, indentSize = 2, indentLevel = 1): string {
    const indent = ' '.repeat(indentSize * indentLevel);
    let rubyHash = '{\n';

    const keys = Object.keys(json);
    for (const key of keys) {
      if (["$schema", "$id", "title"].includes(key)) {
        continue;
      }
      const value = json[key];
      if (value === undefined) {
        continue;
      }

      let formattedValue;
      if (Array.isArray(value) && value.every((item: any) => typeof item === "string")) {
        formattedValue = value.map((item: string) => `${item}`).join(' ');
        formattedValue = `%w[${formattedValue}]`;
      } else if (typeof value === 'object' && value !== null) {
        formattedValue = this.convertJsonToRubyHash(value, indentSize, indentLevel + 1).trim();
      } else if (typeof value === 'string' && value !== 'date-time') {
        formattedValue = `:${value}`;
      } else if (value === null) {
        formattedValue = 'nil';
      } else {
        formattedValue = JSON.stringify(value).replace(/"([^"]+)"/g, "'$1'");
      }

      rubyHash += `${indent}${key}: ${formattedValue},\n`;
    }

    // remove ',' from last element
    rubyHash = rubyHash.replace(/,(?=[^,]*$)/, '');

    if ((/\{\n$/).test(rubyHash)) {
      // handle empty json object to make rubocop happy
      rubyHash = rubyHash.trimRight();
      rubyHash += '}';
    } else {
      rubyHash += `${indent.slice(0, -indentSize)}}`;
    }

    return rubyHash;
  }

  private convertPlurarlToSingularWord(pluralWord: string): string {
    const irregularWords: { [key: string]: string } = {
      children: "child",
    };

    const rules: [RegExp, string][] = [
      [/ies$/, "y"],
      [/es$/, ""],
      [/s$/, ""],
    ];

    // check if the word is an irregular plural
    if (irregularWords.hasOwnProperty(pluralWord.toLowerCase())) {
      return irregularWords[pluralWord.toLowerCase()];
    }

    // apply the pluralization rules
    for (const [rule, replacement] of rules) {
      if (rule.test(pluralWord)) {
        return pluralWord.replace(rule, replacement);
      }
    }

    return pluralWord;
  }

  private convertJsonListToRubyHash(json: any, indentSize = 2, indentLevel = 1): string {
    const rubyHash = this.convertJsonToRubyHash(json.properties.data.items, indentSize, indentLevel);
    const rubyHashList = `{
      type: :object,
      required: %w[data],
      properties: {
        data: {
          type: :array,
          items: [ ${rubyHash} ]
        }
      }
    }`;

    return rubyHashList;
  }
}
