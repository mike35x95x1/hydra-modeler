/* src/core/main.ts */

type LooseAttributes<T> = {
  [K in keyof T as T[K] extends undefined ? never : K]: any;
} & {
  [K in keyof T as T[K] extends undefined ? K : never]?: any;
};

interface HydraAssociation {
  as: string;
  associationType: string;
  foreignKey?: string;
  source: IHydrationModelWithAssociations;
  sourceKey: string;
  target: IHydrationModelWithAssociations;
  targetKey: string;
  through?: {
    model: IHydrationModelWithAssociations;
    alias?: string;
    foreignKey: string;
    otherKey: string;
  };
}

export interface CreateHydraBelongsToAssociation<
  TModels,
  SourceName extends keyof TModels,
  TargetName extends Extract<keyof TModels, string>,
> {
  as?: string;
  foreignKey?: Extract<keyof TModels[SourceName], string>;
  sourceKey?: Extract<keyof TModels[SourceName], string>;
  targetKey?: Extract<keyof TModels[TargetName], string>;
}

export interface CreateHydraHasOneAssociation<
  TModels,
  SourceName extends keyof TModels,
  TargetName extends Extract<keyof TModels, string>,
> {
  as?: string;
  foreignKey?: Extract<keyof TModels[TargetName], string>;
  sourceKey?: Extract<keyof TModels[SourceName], string>;
  targetKey?: Extract<keyof TModels[TargetName], string>;
}

export interface CreateHydraHasManyAssociation<
  TModels,
  SourceName extends keyof TModels,
  TargetName extends Extract<keyof TModels, string>,
> {
  foreignKey?: Extract<keyof TModels[TargetName], string>;
  sourceKey?: Extract<keyof TModels[SourceName], string>;
  targetKey?: Extract<keyof TModels[TargetName], string>;
}

export interface CreateHydraBelongsToManyAssociation<
  TModels,
  SourceName extends keyof TModels,
  TargetName extends Extract<keyof TModels, string>,
  ThroughName extends Extract<keyof TModels, string>,
> {
  as?: string;
  through?: {
    foreignKey?: Extract<keyof TModels[ThroughName], string>;
    otherKey?: Extract<keyof TModels[ThroughName], string>;
    as?: string;
  };
  sourceKey?: Extract<keyof TModels[SourceName], string>;
  targetKey?: Extract<keyof TModels[TargetName], string>;
}

export interface IHydraBaseModel {
  name: string;
  attributes: Record<string, any>;
  primaryKey: string;
}

export interface IHydrationModelWithAssociations extends IHydraBaseModel {
  associations: Map<string, HydraAssociation>;
}

type HydraColumnFilter<T> =
  | readonly Extract<keyof T, string>[]
  | { readonly exclude: readonly Extract<keyof T, string>[] };

// Custom errors
export class SchemaModelNotFoundError extends Error {
  constructor(modelName: string) {
    super(`Model '${modelName}' not found in tree.`);
    this.name = 'SchemaModelNotFoundError';
  }
}

export class NodeModelNotFoundError extends Error {
  constructor(modelName: string) {
    super(`Model '${modelName}' not found in tree.`);
    this.name = 'NodeModelNotFoundError';
  }
}

export class AssociationNotDeclaredError extends Error {
  constructor(sourceModel: string, targetOrAlias: string) {
    super(
      `No explicit association from "${sourceModel}" to "${targetOrAlias}". You must declare associations explicitly.`,
    );
    this.name = 'AssociationNotDeclaredError';
  }
}

export class BelongsToManyThroughModelMissingError extends Error {
  constructor(sourceModel: string, childModel: string) {
    super(
      `Missing "throughModel" for BelongsToMany association from "${sourceModel}" to "${childModel}".`,
    );
    this.name = 'BelongsToManyThroughModelMissingError';
  }
}

export class SchemaAliasMissingError extends Error {
  constructor(aliasIn: string, nodeModel: string, available: string[]) {
    super(
      `Alias "${aliasIn}" (from schema node "${nodeModel}") not found as any column prefix in the input dataset.\n` +
        `Available column prefixes: ${available.join(', ')}`,
    );
    this.name = 'SchemaAliasMissingError';
  }
}

export class HasManyMissingAliasError extends Error {
  constructor(sourceModel: string, targetModel: string) {
    super(
      `Target ${targetModel} in ${sourceModel} model hasMany association requires an explicit "as" property`,
    );
    this.name = 'HasManyMissingAliasError';
  }
}

export class ThroughModelNotRegisteredError extends Error {
  constructor(throughModel: string, sourceModel: string, targetModel: string) {
    super(
      `Through model ${throughModel} for association from ${sourceModel} to ${targetModel} not found.`,
    );
    this.name = 'ThroughModelNotRegisteredError';
  }
}

export class ModelNotRegisteredError extends Error {
  constructor(modelName: string) {
    super(`Model ${modelName} not found.`);
    this.name = 'ModelNotRegisteredError';
  }
}

export class InternalCloneModelMissingError extends Error {
  constructor(modelName: string) {
    super(`Model ${modelName} not found during cloning`);
    this.name = 'InternalCloneModelMissingError';
  }
}

export class PrefixedPrimaryKeyNotFoundInFlatRowsError extends Error {
  constructor(prefix: string, primaryKey: string | string[]) {
    const pk = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
    super(`Primary key (${pk.join(', ')}) with prefix '${prefix}' not found in flat rows.`);
    this.name = 'PrimaryKeyNotFoundInFlatRowsError';
  }
}

export class AllFlatRowsMustHaveSamePropertiesError extends Error {
  constructor() {
    super(`All flat rows must have same properties.`);
    this.name = 'AllFlatRowsMustHaveSamePropertiesError';
  }
}

export class ModelIsMissingAliasError extends Error {
  constructor(model: string) {
    super(`Model ${model} must have explicit alias defined.`);
    this.name = 'ModelIsMissingAliasError';
  }
}

// HydraModel implementation

class HydraModel<TAttrs extends Record<string, any> = Record<string, any>> {
  private _name: string;
  private _attributes: TAttrs;
  private _primaryKey: string;

  constructor(name: string, attributes: LooseAttributes<TAttrs>, primaryKey?: keyof TAttrs) {
    this._name = name;
    this._primaryKey = String(primaryKey ?? 'code');

    this._attributes = this.filterValidAttributes(attributes);

    const mapAttributes = new Map<string, unknown>(Object.entries(this._attributes));
    if (!mapAttributes.has(this._primaryKey)) {
      mapAttributes.set(this._primaryKey, {});
      this._attributes = mapAttributes as unknown as TAttrs & { code: unknown };
    }
  }

  private filterValidAttributes(attributes: LooseAttributes<TAttrs>) {
    const filteredAttributes = Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => {
        if (value == null || typeof value !== 'object') return true;
        const v = value as { type?: { constructor?: { name?: string } } };
        return v.type?.constructor?.name !== 'VIRTUAL';
      }),
    ) as TAttrs;
    return filteredAttributes;
  }

  get name(): string {
    return this._name;
  }

  get attributes(): TAttrs {
    return this._attributes;
  }

  get primaryKey(): string {
    return this._primaryKey;
  }
}

// ------------ Schema types ------------
export type HydraAlias = string;
type AnyHydrationNode<TModels> = {
  [K in Extract<keyof TModels, string>]: HydrationSchemaNode<TModels, K>;
}[Extract<keyof TModels, string>];

export type HydrationSchemaNode<
  TModels,
  ModelName extends Extract<keyof TModels, string> = Extract<keyof TModels, string>,
  R extends Record<string, any> = TModels[ModelName] & Record<string, any>,
> = {
  model: ModelName;
  /**
   * When provided, this single alias is used for:
   * - flat input prefix (column prefix in flatRows),
   * - association lookup key (must match declared `as`),
   * - output key in the hydrated object.
   */
  alias?: HydraAlias;
  postProcess?: (
    row: TModels[ModelName] & Record<string, any>,
    parents: Record<string, Record<string, any>>,
  ) => R;
  children?: AnyHydrationNode<TModels>[];
};

// ------------ Hydrator -------------

class Hydrator {
  static hydrate<
    TModels extends Record<string, any>,
    ReturnType extends Record<string, any> = Record<string, any>,
  >(
    flatRows: Record<string, any>[],
    hydraBuilder: HydraModeler<TModels>,
    schema: HydrationSchemaNode<TModels, Extract<keyof TModels, string> & string>,
  ): ReturnType[] {
    // Check all aliases first (flat prefixes only)
    this.checkAllSchemaAliasesPresent(schema, flatRows);

    const rootAlias = this.alias(schema);
    const rootModel = hydraBuilder.getModel(schema.model, {
      noThrow: true,
    });
    if (!rootModel) throw new SchemaModelNotFoundError(schema.model);

    const groups = this.groupRowsByPK(flatRows, rootModel, rootAlias);
    const results: ReturnType[] = [];

    for (const [, group] of groups) {
      const hydrated = this.hydrateModelRecursive(hydraBuilder, schema as any, group, {});
      results.push(hydrated as ReturnType);
    }

    return results;
  }

  static alias(schema: { model: string; alias?: string }): string {
    return schema.alias || schema.model;
  }

  private static groupRowsByPK(
    rows: Record<string, any>[],
    model: IHydrationModelWithAssociations,
    alias: string,
  ): Map<string, Record<string, any>[]> {
    if (!alias) throw new ModelIsMissingAliasError(model.name);
    const map = new Map<string, Record<string, any>[]>();
    if (!rows.length) return map;

    const primaryKeyName = `${alias}.${model.primaryKey}`;
    const first = rows[0];
    if (!first) return map;
    const primaryKeyExists = Object.prototype.hasOwnProperty.call(first, primaryKeyName);
    if (!primaryKeyExists) {
      throw new PrefixedPrimaryKeyNotFoundInFlatRowsError(alias, model.primaryKey);
    }
    for (const row of rows) {
      const pkValue = row[`${alias}.${model.primaryKey}`];
      if (!pkValue) continue;
      const group = map.get(pkValue) ?? [];
      group.push(row);
      map.set(pkValue, group);
    }
    return map;
  }

  private static hydrateModelRecursive<
    TModels extends Record<string, any>,
    M extends Extract<keyof TModels, string>,
  >(
    hydraBuilder: HydraModeler<TModels>,
    node: HydrationSchemaNode<TModels, M>,
    rows: Record<string, any>[],
    parentsIn: Partial<Record<string, Record<string, any>>> = {},
  ): Record<string, any> {
    // resolve model (custom error if missing)
    const model = hydraBuilder.getModel(node.model as any, {
      noThrow: true,
    });
    if (!model) {
      throw new NodeModelNotFoundError(String(node.model));
    }

    const alias = this.alias(node);

    const row = rows[0];
    if (!row) return {};
    const result: Record<string, any> = {};
    for (const attr of Object.keys(model.attributes)) {
      const key = `${alias}.${attr}`;
      if (key in row) result[attr] = row[key];
    }

    const newParents: Partial<Record<string, Record<string, any>>> = {
      ...parentsIn,
      [alias]: result,
    };

    for (const child of node.children ?? []) {
      const childAlias = this.alias(child);

      const hasKeys = rows.some((r) => Object.keys(r).some((k) => k.startsWith(`${childAlias}.`)));
      if (!hasKeys) continue;

      const assocKey = (child.alias as string) || (child.model as string);
      const assoc = hydraBuilder.getAssociation(model.name, assocKey);
      if (!assoc) {
        throw new AssociationNotDeclaredError(model.name, assocKey);
      }

      const outputKey = typeof child.alias === 'undefined' ? assoc.as : (childAlias as string);

      // BelongsToMany branch
      if (assoc.associationType === 'BelongsToMany') {
        if (!assoc.through?.model) {
          throw new BelongsToManyThroughModelMissingError(model.name, child.model as string);
        }

        const parentSourceKey = (assoc.sourceKey || assoc.source.primaryKey) as string;
        const childTargetKey = (assoc.targetKey || assoc.target.primaryKey) as string;

        // parent's PK value from its flat alias
        const parentPkValue = row[`${alias}.${parentSourceKey}`];

        // join alias comes from association (authoritative)
        const joinAlias = assoc.through.alias ?? assoc.through.model.name;

        // inferred key names when not provided
        const joinToParentFK =
          assoc.through.foreignKey || assoc.source.name + hydraBuilder.defaultForeignKeySuffix;

        const joinToChildFK =
          assoc.through.otherKey || assoc.target.name + hydraBuilder.defaultForeignKeySuffix;

        // keep only rows that belong to this parent via the join's FK,
        // have a non-null child PK, and (if present) a matching join.otherKey
        const relevantRows = rows.filter((r) => {
          const parentMatch = r[`${joinAlias}.${joinToParentFK}`] === parentPkValue;
          if (!parentMatch) return false;

          const childPk = r[`${childAlias}.${childTargetKey}`];
          if (childPk == null) return false; // exclude "null child" rows

          const joinOther = r[`${joinAlias}.${joinToChildFK}`];
          return joinOther == null || joinOther === childPk;
        });

        const grouped = new Map<string, Record<string, any>[]>();
        for (const r of relevantRows) {
          const childPkVal = r[`${childAlias}.${childTargetKey}`] as string;
          const bucket = grouped.get(childPkVal);
          if (bucket) bucket.push(r);
          else grouped.set(childPkVal, [r]);
        }

        (result as any)[outputKey] = Array.from(grouped.values()).map((group) =>
          this.hydrateModelRecursive(hydraBuilder, child, group, newParents),
        );
        continue;
      }

      // Direct associations (HasMany, HasOne, BelongsTo)
      const grouped = this.groupRowsByPK(rows, assoc.target, childAlias);

      if (assoc.associationType === 'HasMany') {
        (result as any)[outputKey] = Array.from(grouped.values()).map((group) =>
          this.hydrateModelRecursive(hydraBuilder, child, group, newParents),
        );
      } else {
        const firstGroup = Array.from(grouped.values())[0];
        if (firstGroup) {
          (result as any)[outputKey] = this.hydrateModelRecursive(
            hydraBuilder,
            child,
            firstGroup,
            newParents,
          );
        }
      }
    }

    // Build a strict parents record (drop undefined entries)
    const parentsStrict = Object.fromEntries(
      Object.entries(newParents).filter(([, v]) => v != null),
    ) as Record<string, Record<string, any>>;

    const processedResult = node.postProcess
      ? node.postProcess(result as TModels[M] & Record<string, any>, parentsStrict)
      : result;
    return processedResult;
  }

  // --- Check all schema aliases are present in flatRows ---

  private static checkAllSchemaAliasesPresent<TModels extends Record<string, any>>(
    schema: HydrationSchemaNode<TModels>,
    flatRows: Record<string, any>[],
  ): void {
    if (!flatRows.length) return;

    const row = flatRows[0];
    if (!row) return;
    const colPrefixes = new Set<string>(
      Object.keys(row)
        .map((key) => key.split('.')[0])
        .filter((p): p is string => p !== undefined),
    );
    const checkNode = (node: HydrationSchemaNode<TModels>): void => {
      const a = this.alias(node);
      if (!colPrefixes.has(a)) {
        throw new SchemaAliasMissingError(a, node.model, Array.from(colPrefixes));
      }
      for (const child of node.children ?? []) checkNode(child);
    };

    checkNode(schema);
  }
}

// ------------ Main HydraBuilder ------------

interface HydraModelerOptions {
  defaultPrimaryKey?: string;
  defaultForeignKeySuffix?: string;
}

export class HydraModeler<TModels extends Record<string, any>> {
  private _models: Map<keyof TModels, HydraModel<any>> = new Map();
  private _associations: Map<string, Map<string, HydraAssociation>> = new Map();
  private _options: HydraModelerOptions;

  constructor();
  constructor(options: HydraModelerOptions);
  constructor(from: HydraModeler<any>);
  constructor(hydraOrOptions?: HydraModeler<any> | HydraModelerOptions) {
    if (hydraOrOptions instanceof HydraModeler) {
      this._options = hydraOrOptions.options;
      this.cloneFromModeler(hydraOrOptions);
    } else {
      const opts = hydraOrOptions ?? {};
      this._options = {
        ...opts,
        defaultForeignKeySuffix: opts.defaultForeignKeySuffix || 'Code',
        defaultPrimaryKey: opts.defaultPrimaryKey || 'code',
      };
    }
  }

  // --- Utilities ---
  get models(): Map<keyof TModels, HydraModel<any>> {
    return this._models;
  }

  get options() {
    return { ...this._options };
  }

  get defaultPrimaryKey() {
    return this._options.defaultPrimaryKey!;
  }
  get defaultForeignKeySuffix() {
    return this._options.defaultForeignKeySuffix!;
  }

  // ensure association map exists
  private ensureAssocMap(modelName: keyof TModels): Map<string, HydraAssociation> {
    const key = String(modelName);
    let map = this._associations.get(key);
    if (!map) {
      map = new Map<string, HydraAssociation>();
      this._associations.set(key, map);
    }
    return map;
  }

  // --------- Model Management (Kysely-style) ----------
  addModels(
    fn: (mb: {
      add: <K extends keyof TModels & string>(
        name: K,
        attributes: LooseAttributes<TModels[K]>,
        primaryKey?: keyof TModels[K],
      ) => typeof mb;
    }) => void,
  ): this {
    const mb = {
      add: <K extends keyof TModels & string>(
        name: K,
        attributes: LooseAttributes<TModels[K]>,
        primaryKey?: keyof TModels[K],
      ) => {
        this._addModel(name, attributes, primaryKey);
        return mb;
      },
    };
    fn(mb);
    return this;
  }

  private _addModel<K extends keyof TModels & string>(
    name: K,
    attributes: LooseAttributes<TModels[K]>,
    primaryKey?: keyof TModels[K],
  ) {
    if (!this._models.has(name)) {
      const model = new HydraModel(name, attributes, primaryKey as string);
      this._models.set(name, model);
      this._associations.set(name as any, new Map());
    }
  }

  // --------- Association Management (Kysely-style) ----------
  associate<SourceName extends Extract<keyof TModels, string>>(
    sourceModelName: SourceName,
    builderFn: (ab: {
      belongsTo: <TargetName extends Extract<keyof TModels, string>>(
        targetModelName: TargetName,
        options?: CreateHydraBelongsToAssociation<TModels, SourceName, TargetName>,
      ) => typeof ab;
      hasOne: <TargetName extends Extract<keyof TModels, string>>(
        targetModelName: TargetName,
        options?: CreateHydraHasOneAssociation<TModels, SourceName, TargetName>,
      ) => typeof ab;
      hasMany: <TargetName extends Extract<keyof TModels, string>>(
        targetModelName: TargetName,
        alias: string,
        options?: CreateHydraHasManyAssociation<TModels, SourceName, TargetName>,
      ) => typeof ab;
      belongsToMany: <
        TargetName extends Extract<keyof TModels, string>,
        ThroughName extends Extract<keyof TModels, string>,
      >(
        targetModelName: TargetName,
        throughModelName: ThroughName,
        options: CreateHydraBelongsToManyAssociation<TModels, SourceName, TargetName, ThroughName>,
      ) => typeof ab;
    }) => void,
  ) {
    const associations: HydraAssociation[] = [];
    const ab = {
      belongsTo: <TargetName extends Extract<keyof TModels, string>>(
        targetModelName: TargetName,
        options: CreateHydraBelongsToAssociation<TModels, SourceName, TargetName> = {},
      ) => {
        const { sourceKey = this.defaultPrimaryKey, targetKey = this.defaultPrimaryKey } = options;
        const as = options.as ?? targetModelName;
        const foreignKey =
          options.foreignKey ?? `${targetModelName}${this.defaultForeignKeySuffix}`;

        const source = this.getModel(sourceModelName);
        const target = this.getModel(targetModelName);
        associations.push({
          as,
          associationType: 'BelongsTo',
          foreignKey,
          source,
          sourceKey,
          target,
          targetKey,
        });
        return ab;
      },
      hasOne: <TargetName extends Extract<keyof TModels, string>>(
        targetModelName: TargetName,
        options: CreateHydraHasOneAssociation<TModels, SourceName, TargetName> = {},
      ) => {
        const { sourceKey = this.defaultPrimaryKey, targetKey = this.defaultPrimaryKey } = options;
        const as = options.as ?? targetModelName;
        const foreignKey =
          options.foreignKey ?? `${sourceModelName}${this.defaultForeignKeySuffix}`;
        const source = this.getModel(sourceModelName);
        const target = this.getModel(targetModelName);

        associations.push({
          as,
          associationType: 'HasOne',
          foreignKey,
          source,
          sourceKey,
          target,
          targetKey,
        });
        return ab;
      },
      hasMany: <TargetName extends Extract<keyof TModels, string>>(
        targetModelName: TargetName,
        alias: string,
        options: CreateHydraHasManyAssociation<TModels, SourceName, TargetName> = {},
      ) => {
        const { sourceKey = this.defaultPrimaryKey, targetKey = this.defaultPrimaryKey } = options;
        if (!alias) {
          throw new HasManyMissingAliasError(sourceModelName as string, targetModelName as string);
        }
        const foreignKey =
          options.foreignKey ?? `${sourceModelName}${this.defaultForeignKeySuffix}`;

        const source = this.getModel(sourceModelName);
        const target = this.getModel(targetModelName);

        associations.push({
          as: alias,
          associationType: 'HasMany',
          foreignKey,
          source,
          sourceKey,
          target,
          targetKey,
        });
        return ab;
      },
      belongsToMany: <
        TargetName extends Extract<keyof TModels, string>,
        ThroughName extends Extract<keyof TModels, string>,
      >(
        targetModelName: TargetName,
        throughModelName: ThroughName,
        options: CreateHydraBelongsToManyAssociation<TModels, SourceName, TargetName, ThroughName>,
      ) => {
        const { sourceKey = this.defaultPrimaryKey, targetKey = this.defaultPrimaryKey } = options;
        const as = options.as ?? targetModelName;
        const foreignKey =
          options.through?.foreignKey ?? `${sourceModelName}${this.defaultForeignKeySuffix}`;
        const otherKey =
          options.through?.otherKey ?? `${targetModelName}${this.defaultForeignKeySuffix}`;

        const source = this.getModel(sourceModelName);
        const target = this.getModel(targetModelName);
        const throughModel = this.getModel(throughModelName, {
          noThrow: true,
        });
        if (!throughModel) {
          throw new ThroughModelNotRegisteredError(
            throughModelName as string,
            sourceModelName as string,
            targetModelName as string,
          );
        }

        associations.push({
          as,
          associationType: 'BelongsToMany',
          foreignKey,
          source,
          sourceKey,
          target,
          targetKey,
          through: options.through?.as
            ? {
                model: throughModel,
                foreignKey,
                otherKey,
                alias: options.through.as,
              }
            : {
                model: throughModel,
                foreignKey,
                otherKey,
              },
        });
        return ab;
      },
    };
    builderFn(ab as any);

    for (const association of associations) {
      const mapModelAssociations = this.ensureAssocMap(sourceModelName);
      if (!mapModelAssociations.has(association.as)) {
        mapModelAssociations.set(association.as, association);
      }
    }
    return this;
  }

  // --- getModel overloads for better narrowing ---
  getModel(name: keyof TModels): IHydrationModelWithAssociations;
  getModel(name: keyof TModels, options: { noThrow: true }): IHydrationModelWithAssociations | null;
  getModel(
    name: keyof TModels,
    options?: { noThrow?: boolean },
  ): IHydrationModelWithAssociations | null {
    const { noThrow } = options ?? {};
    const model = this._models.get(name);
    if (!model) {
      if (!noThrow) throw new ModelNotRegisteredError(String(name));
      return null;
    }
    return {
      name: model.name,
      attributes: model.attributes,
      primaryKey: model.primaryKey as string,
      associations: this.ensureAssocMap(name),
    };
  }

  getAssociations(modelName: string): Map<string, HydraAssociation> {
    return this.ensureAssocMap(modelName as keyof TModels);
  }
  getAssociation(modelName: string, associationName: string): HydraAssociation | undefined {
    return this.getAssociations(modelName as string).get(associationName);
  }

  /**
   * Returns an array of aliased column selections for the specified model.
   */
  columns<Model extends Extract<keyof TModels, string>>(
    modelName: Model,
    filters?: HydraColumnFilter<TModels[Model]>,
  ): `"${Model}"."${string}" as "${Model}.${string}"`[];
  /**
   * Returns an array of aliased column selections for the specified model with SQL alias.
   */
  columns<Model extends Extract<keyof TModels, string>, Alias extends string>(
    modelName: Model,
    alias: Alias,
    filters?: HydraColumnFilter<TModels[Model]>,
  ): `"${Model}"."${string}" as "${Alias}.${string}"`[];
  /**
   * Processed column selections using a transformer.
   */
  columns<T, Model extends Extract<keyof TModels, string>>(
    processor: (col: string) => T,
    modelName: Model,
    _filters?: HydraColumnFilter<TModels[Model]>,
  ): readonly any[];
  /**
   * Processed column selections using a transformer with SQL alias.
   */
  columns<T, Model extends Extract<keyof TModels, string>>(
    processor: (col: string) => T,
    modelName: Model,
    alias: string,
    filters?: HydraColumnFilter<TModels[Model]>,
  ): readonly any[];
  columns(...args: any[]): any {
    const normalize = (a: any[]) => {
      if (typeof a[0] === 'function') {
        // columns(processor, model [, alias] [, filters])
        const processor = a[0];
        const modelName = a[1];
        let alias: string | undefined;
        let filters: readonly string[] | { readonly exclude: readonly string[] } | undefined;
        if (typeof a[2] === 'string') {
          alias = a[2];
          filters = a[3];
        } else {
          filters = a[2];
        }
        return { processor, modelName, alias, filters };
      }
      // columns(model [, alias] [, filters])
      const modelName = a[0];
      let alias: string | undefined;
      let filters: readonly string[] | { readonly exclude: readonly string[] } | undefined;
      if (typeof a[1] === 'string') {
        alias = a[1];
        filters = a[2];
      } else {
        filters = a[1];
      }
      return { processor: undefined, modelName, alias, filters };
    };

    const { processor, modelName, alias, filters } = normalize(args);

    const model = this.getModel(modelName);
    const normAlias = alias ?? (modelName as string);

    const filterKeys = (keys: string[], f?: HydraColumnFilter<any>) =>
      !f
        ? keys
        : 'exclude' in f
          ? keys.filter((k) => !f.exclude.includes(k))
          : keys.filter((k) => f.includes(k));

    const selections = filterKeys(Object.keys(model.attributes), filters).map(
      (key) => `"${normAlias}"."${key}" as "${normAlias}.${key}"`,
    );

    return processor ? selections.map(processor) : selections;
  }

  private cloneFromModeler(source: HydraModeler<any>): void {
    this._models = new Map();
    this._associations = new Map();

    for (const [name, model] of source._models as Map<string, HydraModel<any>>) {
      const cloned = new HydraModel(
        model.name,
        model.attributes as LooseAttributes<any>,
        model.primaryKey as string,
      );
      this._models.set(name as any, cloned);
      this._associations.set(String(name), new Map());
    }

    // local helper to expose HydraModel as IHydrationModelWithAssociations
    const wrap = (modelName: string): IHydrationModelWithAssociations => {
      const m = this._models.get(modelName as any);
      const assocMap = this._associations.get(String(modelName));
      if (!m || !assocMap) {
        throw new InternalCloneModelMissingError(modelName);
      }
      return {
        name: m.name,
        attributes: m.attributes,
        primaryKey: m.primaryKey as string,
        associations: assocMap,
      };
    };

    // 2) clone associations, re-binding to this instance's models
    for (const [srcName, assocMap] of source._associations as Map<
      string,
      Map<string, HydraAssociation>
    >) {
      const clonedMap = new Map<string, HydraAssociation>();
      for (const [as, assoc] of assocMap) {
        const entry: HydraAssociation = {
          as: assoc.as,
          associationType: assoc.associationType,
          source: wrap(srcName),
          sourceKey: assoc.sourceKey,
          target: wrap(assoc.target.name),
          targetKey: assoc.targetKey,
          ...(assoc.foreignKey !== undefined ? { foreignKey: assoc.foreignKey } : {}),
          ...(assoc.through
            ? {
                through: {
                  model: wrap(assoc.through.model.name),
                  foreignKey: assoc.through.foreignKey,
                  otherKey: assoc.through.otherKey,
                  ...(assoc.through.alias !== undefined ? { alias: assoc.through.alias } : {}),
                },
              }
            : {}),
        };

        clonedMap.set(as, entry);
      }
      this._associations.set(srcName, clonedMap);
    }
  }

  // ---- Hydration API (instance method, type-safe) ----

  hydrate<
    ReturnType extends Record<string, any> = Record<string, any>,
    T extends TModels = TModels,
  >(flatRows: Record<string, any>[], schema: HydrationSchemaNode<T>): ReturnType[] {
    if (!this.allObjectsHaveSameProperties(flatRows))
      throw new AllFlatRowsMustHaveSamePropertiesError();
    return Hydrator.hydrate(flatRows, this as unknown as HydraModeler<T>, schema);
  }

  private allObjectsHaveSameProperties<T extends Record<string, any>>(rows: T[]): boolean {
    if (rows.length <= 1) return true;
    const referenceKeys = Object.keys(rows[0]!).sort().join('|');
    return rows.every((row) => Object.keys(row).sort().join('|') === referenceKeys);
  }
}
