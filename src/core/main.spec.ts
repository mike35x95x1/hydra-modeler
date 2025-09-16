// hydra-modeler.spec.ts
import {
  HydraModeler,
  type HydrationSchemaNode,
  // error classes:
  SchemaModelNotFoundError,
  NodeModelNotFoundError,
  AssociationNotDeclaredError,
  BelongsToManyThroughModelMissingError,
  SchemaAliasMissingError,
  HasManyMissingAliasError,
  type IHydrationModelWithAssociations,
  AllFlatRowsMustHaveSamePropertiesError,
  PrefixedPrimaryKeyNotFoundInFlatRowsError,
} from './main';

describe('DataHydra', () => {
  // 1. Model attributes definitions
  type Models = {
    Customer: { code: string; name: string; AddressCode: string };
    Address: { code: string; street: string };
    Product: { code: string; name: string; CustomerCode: string };
    Edition: { code: string; name: string; ProductCode: string };
    CustomerProduct: {
      CustomerCode: string;
      ProductCode: string;
      meta: {};
    };
  };

  // 2. HydraBuilder setup (attributes and associations)
  let builder: HydraModeler<Models>;
  beforeEach(() => {
    builder = new HydraModeler<Models>();
    builder
      .addModels((mb) =>
        mb
          .add('Customer', { code: {}, name: {}, AddressCode: {} })
          .add('Address', { code: {}, street: {} })
          .add('Product', { code: {}, name: {}, CustomerCode: {} })
          .add('Edition', { code: {}, name: {}, ProductCode: {} }),
      )
      .associate('Customer', (ab) => ab.hasMany('Product', 'Products'))
      .associate('Customer', (ab) => ab.belongsTo('Address'))
      .associate('Product', (ab) => ab.hasMany('Edition', 'Editions'));
  });

  it('hydrates Customer -> Address (BelongsTo)', () => {
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Customer.AddressCode': 'A1',
        'Address.code': 'A1',
        'Address.street': 'Street 1',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer', // Type '"Customer"' is not assignable to type '"charAt" | "charCodeAt" | "concat" | "indexOf" | "lastIndexOf" | "localeCompare" | "match" | "replace" | "search" | "slice" | "split" | "substring" | "toLowerCase" | "toLocaleLowerCase" | ... 34 more ... | "valueOf"'.ts(2322)
      children: [{ model: 'Address' }],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      // Argument of type 'HydrationSchemaNode<keyof Models>' is not assignable to parameter of type 'HydrationSchemaNode<Models, keyof Models, ({ code: string; name: string; AddressCode: string; } | { code: string; street: string; } | { code: string; name: string; CustomerCode: string; } | { ...; } | { ...; }) & Record<...>>' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties. Types of property 'model' are incompatible. Type '"charAt" | "charCodeAt" | "concat" | "indexOf" | "lastIndexOf" | "localeCompare" | "match" | "replace" | "search" | "slice" | "split" | "substring" | "toLowerCase" | "toLocaleLowerCase" | ... 34 more ... | "valueOf"' is not assignable to type 'keyof Models'. Type '"charAt"' is not assignable to type 'keyof Models'.ts(2379)
      {
        code: 'C1',
        name: 'Customer A',
        AddressCode: 'A1',
        Address: {
          code: 'A1',
          street: 'Street 1',
        },
      },
    ]);
  });

  it('hydrates Customer -> Products -> Editions (HasMany)', () => {
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P1',
        'Products.name': 'Product One',
        'Products.CustomerCode': 'C1',
        'Editions.code': 'E1',
        'Editions.name': 'Standard',
        'Editions.ProductCode': 'P1',
      },
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P2',
        'Products.name': 'Product Two',
        'Products.CustomerCode': 'C1',
        'Editions.code': 'E2',
        'Editions.name': 'Pro',
        'Editions.ProductCode': 'P2',
      },
      {
        'Customer.code': 'C2',
        'Customer.name': 'Customer B',
        'Products.code': 'P3',
        'Products.name': 'Product Three',
        'Products.CustomerCode': 'C2',
        'Editions.code': 'E31',
        'Editions.name': 'Enterprise',
        'Editions.ProductCode': 'P3',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [
        {
          model: 'Product',
          alias: 'Products',
          children: [
            {
              model: 'Edition',
              alias: 'Editions',
            },
          ],
        },
      ],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        Products: [
          {
            code: 'P1',
            name: 'Product One',
            CustomerCode: 'C1',
            Editions: [
              {
                code: 'E1',
                name: 'Standard',
                ProductCode: 'P1',
              },
            ],
          },
          {
            code: 'P2',
            name: 'Product Two',
            CustomerCode: 'C1',
            Editions: [
              {
                code: 'E2',
                name: 'Pro',
                ProductCode: 'P2',
              },
            ],
          },
        ],
      },
      {
        code: 'C2',
        name: 'Customer B',
        Products: [
          {
            code: 'P3',
            name: 'Product Three',
            CustomerCode: 'C2',
            Editions: [
              {
                code: 'E31',
                name: 'Enterprise',
                ProductCode: 'P3',
              },
            ],
          },
        ],
      },
    ]);
  });

  it('hydrates Customer <-> Product (BelongsToMany)', () => {
    // Add join table and association
    builder
      .addModels((mb) =>
        mb.add('CustomerProduct', {
          CustomerCode: {},
          ProductCode: {},
          meta: {},
        }),
      )
      .associate('Customer', (ab) =>
        ab.belongsToMany('Product', 'CustomerProduct', {
          as: 'Products',
          through: {
            as: 'CustomerProducts',
          },
        }),
      );

    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Customer.AddressCode': 'A1',
        'Products.code': 'P1',
        'Products.name': 'Product One',
        'Products.CustomerCode': 'C1',
        'CustomerProducts.CustomerCode': 'C1',
        'CustomerProducts.ProductCode': 'P1',
        'CustomerProducts.meta': 'foo',
      },
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Customer.AddressCode': 'A1',
        'Products.code': 'P2',
        'Products.name': 'Product Two',
        'Products.CustomerCode': 'C1',
        'CustomerProducts.CustomerCode': 'C1',
        'CustomerProducts.ProductCode': 'P2',
        'CustomerProducts.meta': 'bar',
      },
      {
        'Customer.code': 'C2',
        'Customer.name': 'Customer B',
        'Customer.AddressCode': 'A2',
        'Products.code': 'P2',
        'Products.name': 'Product Two',
        'Products.CustomerCode': 'C1',
        'CustomerProducts.CustomerCode': 'C2',
        'CustomerProducts.ProductCode': 'P2',
        'CustomerProducts.meta': 'baz',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [
        {
          model: 'Product',
          alias: 'Products',
        },
      ],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        AddressCode: 'A1',
        Products: [
          {
            code: 'P1',
            name: 'Product One',
            CustomerCode: 'C1',
          },
          {
            code: 'P2',
            name: 'Product Two',
            CustomerCode: 'C1',
          },
        ],
      },
      {
        code: 'C2',
        name: 'Customer B',
        AddressCode: 'A2',
        Products: [
          {
            code: 'P2',
            name: 'Product Two',
            CustomerCode: 'C1',
          },
        ],
      },
    ]);
  });

  // --- Tests updated for alias being a strict string ---

  it('hydrates Customer -> Products using string alias', () => {
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P1',
        'Products.name': 'Product One',
        'Products.CustomerCode': 'C1',
      },
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P2',
        'Products.name': 'Product Two',
        'Products.CustomerCode': 'C1',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [{ model: 'Product', alias: 'Products' }],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        Products: [
          { code: 'P1', name: 'Product One', CustomerCode: 'C1' },
          { code: 'P2', name: 'Product Two', CustomerCode: 'C1' },
        ],
      },
    ]);
  });

  it('supports root string alias (root remains unwrapped)', () => {
    const flat = [
      {
        'C.code': 'C1',
        'C.name': 'Customer A',
        'C.AddressCode': 'A1',
        'Address.code': 'A1',
        'Address.street': 'Street 1',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      alias: 'C',
      children: [{ model: 'Address' }],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        AddressCode: 'A1',
        Address: { code: 'A1', street: 'Street 1' },
      },
    ]);
  });

  it('hydrates Customer <-> Product (BelongsToMany) using string alias', () => {
    builder
      .addModels((mb) =>
        mb.add('CustomerProduct', {
          CustomerCode: {},
          ProductCode: {},
          meta: {},
        }),
      )
      .associate('Customer', (ab) =>
        ab.belongsToMany('Product', 'CustomerProduct', {
          as: 'Products',
          through: { as: 'CustomerProducts' },
        }),
      );

    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P1',
        'Products.name': 'Product One',
        'Products.CustomerCode': 'C1',
        'CustomerProducts.CustomerCode': 'C1',
        'CustomerProducts.ProductCode': 'P1',
        'CustomerProducts.meta': 'foo',
      },
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P2',
        'Products.name': 'Product Two',
        'Products.CustomerCode': 'C1',
        'CustomerProducts.CustomerCode': 'C1',
        'CustomerProducts.ProductCode': 'P2',
        'CustomerProducts.meta': 'bar',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [{ model: 'Product', alias: 'Products' }],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        Products: [
          { code: 'P1', name: 'Product One', CustomerCode: 'C1' },
          { code: 'P2', name: 'Product Two', CustomerCode: 'C1' },
        ],
      },
    ]);
  });

  it('hydrates nested aliases on multiple levels (Products & Editions) with strings', () => {
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P1',
        'Products.name': 'Product One',
        'Products.CustomerCode': 'C1',
        'Editions.code': 'E1',
        'Editions.name': 'Standard',
        'Editions.ProductCode': 'P1',
      },
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Products.code': 'P1',
        'Products.name': 'Product One',
        'Products.CustomerCode': 'C1',
        'Editions.code': 'E2',
        'Editions.name': 'Pro',
        'Editions.ProductCode': 'P1',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [
        {
          model: 'Product',
          alias: 'Products',
          children: [{ model: 'Edition', alias: 'Editions' }],
        },
      ],
    };

    expect(builder.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        Products: [
          {
            code: 'P1',
            name: 'Product One',
            CustomerCode: 'C1',
            Editions: [
              { code: 'E1', name: 'Standard', ProductCode: 'P1' },
              { code: 'E2', name: 'Pro', ProductCode: 'P1' },
            ],
          },
        ],
      },
    ]);
  });

  // ---------- error tests for custom error classes ----------

  it('throws SchemaAliasMissingError when alias is not present among column prefixes', () => {
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [
        {
          model: 'Product',
          alias: 'P', // no "P." prefix in flat rows
        },
      ],
    };

    expect(() => builder.hydrate(flat, schema)).toThrow(SchemaAliasMissingError);
  });

  it('throws AssociationNotDeclaredError when alias does not match any declared association', () => {
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'WrongKey.code': 'P1',
        'WrongKey.name': 'Product One',
        'WrongKey.CustomerCode': 'C1',
      },
    ];

    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [
        {
          model: 'Product',
          alias: 'WrongKey', // present in flat but not declared in associations
        },
      ],
    };

    expect(() => builder.hydrate(flat, schema)).toThrow(AssociationNotDeclaredError);
  });

  it('throws HasManyMissingAliasError when hasMany is registered without alias', () => {
    expect(() =>
      builder.associate('Customer', (ab) =>
        // bad: missing alias
        ab.hasMany('Product', '' as unknown as string),
      ),
    ).toThrow(HasManyMissingAliasError);
  });

  it('throws SchemaModelNotFoundError when root model is not registered', () => {
    const flat: Record<string, any>[] = []; // ensure alias pre-check returns early
    const schema: HydrationSchemaNode<any> = {
      model: 'MissingRoot',
      children: [],
    };
    expect(() => builder.hydrate(flat, schema)).toThrow(SchemaModelNotFoundError);
  });

  it('throws NodeModelNotFoundError when child model is not registered but alias/association exist', () => {
    // 1) create a fake association Customer -> Ghost under alias "Ghost"
    const customerModel = builder.getModel('Customer') as IHydrationModelWithAssociations;
    const fakeTarget = {
      name: 'Ghost',
      attributes: { code: {} },
      primaryKey: 'code',
      associations: new Map(),
    } as any;

    const customerAssociations = (builder as any)._associations.get('Customer') as Map<string, any>;
    customerAssociations.set('Ghost', {
      as: 'Ghost',
      associationType: 'HasMany',
      foreignKey: 'CustomerCode',
      source: customerModel,
      sourceKey: 'code',
      target: fakeTarget,
      targetKey: 'code',
    });

    // 2) monkey-patch getModel to return null for 'Ghost' (so recursive call throws NodeModelNotFoundError)
    const originalGetModel = (builder as any).getModel.bind(builder);
    (builder as any).getModel = (name: any, options?: any) => {
      if (name === 'Ghost') return null;
      return originalGetModel(name, options);
    };

    // 3) rows contain "Ghost." prefix to force traversal
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Ghost.code': 'G1',
      },
    ];

    const schema: HydrationSchemaNode<any> = {
      model: 'Customer',
      children: [{ model: 'Ghost' }],
    };

    expect(() => builder.hydrate(flat, schema)).toThrow(NodeModelNotFoundError);
  });

  it('throws BelongsToManyThroughModelMissingError when association.through.model is missing at runtime', () => {
    // create legit BTM with a UNIQUE alias to avoid colliding with the existing hasMany('Products')
    builder
      .addModels((mb) =>
        mb.add('CustomerProduct', {
          CustomerCode: {},
          ProductCode: {},
          meta: {},
        }),
      )
      .associate('Customer', (ab) =>
        ab.belongsToMany('Product', 'CustomerProduct', {
          as: 'ProductsViaJoin',
          through: { as: 'CustomerProducts' },
        }),
      );

    // corrupt the BTM association to remove through.model
    const associations = (builder as any)._associations.get('Customer') as Map<string, any>;
    const assoc = associations.get('ProductsViaJoin');
    expect(assoc).toBeTruthy();
    assoc.through.model = undefined;

    // flat rows must use the BTM alias and the through alias
    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'ProductsViaJoin.code': 'P1',
        'ProductsViaJoin.name': 'Product One',
        'ProductsViaJoin.CustomerCode': 'C1',
        'CustomerProducts.CustomerCode': 'C1',
        'CustomerProducts.ProductCode': 'P1',
      },
    ];

    // schema must reference the same alias so the hydrator looks up the BTM association
    const schema: HydrationSchemaNode<any> = {
      model: 'Customer',
      children: [
        {
          model: 'Product',
          alias: 'ProductsViaJoin',
        },
      ],
    };

    expect(() => builder.hydrate(flat, schema)).toThrow(BelongsToManyThroughModelMissingError);
  });

  // ---------- cloning tests ----------

  it('clones models and associations via copy constructor', () => {
    const cloned = new HydraModeler<Models>(builder as any);

    expect(Array.from(cloned.models.keys()).sort()).toEqual(
      Array.from(builder.models.keys()).sort(),
    );

    expect(builder.getAssociations('Customer').has('Products')).toBe(true);
    expect(cloned.getAssociations('Customer').has('Products')).toBe(true);

    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Customer.AddressCode': 'A1',
        'Address.code': 'A1',
        'Address.street': 'Street 1',
      },
    ];
    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [{ model: 'Address' }],
    };
    expect(cloned.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        AddressCode: 'A1',
        Address: { code: 'A1', street: 'Street 1' },
      },
    ]);
  });

  it('clone is independent of future mutations on the source', () => {
    const cloned = new HydraModeler<Models>(builder as any);

    builder.associate('Customer', (ab) => ab.hasOne('Address', { as: 'BillingAddress' }));

    expect(builder.getAssociations('Customer').has('BillingAddress')).toBe(true);
    expect(cloned.getAssociations('Customer').has('BillingAddress')).toBe(false);

    const flat = [
      {
        'Customer.code': 'C1',
        'Customer.name': 'Customer A',
        'Customer.AddressCode': 'A1',
        'Address.code': 'A1',
        'Address.street': 'Street 1',
      },
    ];
    const schema: HydrationSchemaNode<Models> = {
      model: 'Customer',
      children: [{ model: 'Address' }],
    };
    expect(cloned.hydrate(flat, schema)).toEqual([
      {
        code: 'C1',
        name: 'Customer A',
        AddressCode: 'A1',
        Address: { code: 'A1', street: 'Street 1' },
      },
    ]);
  });

  describe('alias mapping pipeline (flat → assoc → hydrate)', () => {
    interface People {
      Person: { code: string; name: string };
      PersonRelation: {
        code: string;
        firstPersonCode: string;
        secondPersonCode: string;
        type: 'friends' | 'siblings' | 'couple';
      };
    }
    const people = new HydraModeler<People>()
      .addModels((m) =>
        m.add('Person', { code: {}, name: {} }).add('PersonRelation', {
          code: {},
          firstPersonCode: {},
          secondPersonCode: {},
          type: {},
        }),
      )
      .associate('Person', (p) =>
        p
          .belongsToMany('Person', 'PersonRelation', {
            as: 'RelatedPeople',
            through: {
              as: 'Relations', // ensure join alias matches the rows we provide
              foreignKey: 'firstPersonCode',
              otherKey: 'secondPersonCode',
            },
          })
          .hasMany('PersonRelation', 'Relations', {
            foreignKey: 'secondPersonCode',
          }),
      )
      .associate('PersonRelation', (pr) => pr.belongsTo('Person'));

    it('hydrates BelongsToMany with string alias (and nested hasMany)', () => {
      const flat = [
        {
          'Person.code': 'P1',
          'Person.name': 'John',
          'RelatedPeople.code': 'P2',
          'RelatedPeople.name': 'Paul',
          'Relations.code': 'P1_P2',
          'Relations.firstPersonCode': 'P1',
          'Relations.secondPersonCode': 'P2',
          'Relations.type': 'friends',
        },
        {
          'Person.code': 'P1',
          'Person.name': 'John',
          'RelatedPeople.code': 'P10',
          'RelatedPeople.name': 'Yoko',
          'Relations.code': 'P1_P10',
          'Relations.firstPersonCode': 'P1',
          'Relations.secondPersonCode': 'P10',
          'Relations.type': 'couple',
        },
        {
          'Person.code': 'P3',
          'Person.name': 'George',
          'RelatedPeople.code': 'P11',
          'RelatedPeople.name': 'Harold',
          'Relations.code': 'P3_P11',
          'Relations.firstPersonCode': 'P3',
          'Relations.secondPersonCode': 'P11',
          'Relations.type': 'siblings',
        },
      ];

      const schema: HydrationSchemaNode<People> = {
        model: 'Person',
        alias: 'Person',
        children: [
          {
            model: 'Person',
            alias: 'RelatedPeople',
            children: [
              {
                model: 'PersonRelation',
                alias: 'Relations',
              },
            ],
          },
        ],
      };

      expect(people.hydrate(flat, schema)).toEqual([
        {
          code: 'P1',
          name: 'John',
          RelatedPeople: [
            {
              code: 'P2',
              name: 'Paul',
              Relations: [
                {
                  code: 'P1_P2',
                  firstPersonCode: 'P1',
                  secondPersonCode: 'P2',
                  type: 'friends',
                },
              ],
            },
            {
              code: 'P10',
              name: 'Yoko',
              Relations: [
                {
                  code: 'P1_P10',
                  firstPersonCode: 'P1',
                  secondPersonCode: 'P10',
                  type: 'couple',
                },
              ],
            },
          ],
        },
        {
          code: 'P3',
          name: 'George',
          RelatedPeople: [
            {
              code: 'P11',
              name: 'Harold',
              Relations: [
                {
                  code: 'P3_P11',
                  firstPersonCode: 'P3',
                  secondPersonCode: 'P11',
                  type: 'siblings',
                },
              ],
            },
          ],
        },
      ]);
    });

    it('hydrates HasMany with a different alias (by declaring an additional association)', () => {
      // declare an extra alias for the same target for this test
      builder.associate('Customer', (ab) => ab.hasMany('Product', 'Items'));

      const flat = [
        {
          'Customer.code': 'C1',
          'Customer.name': 'Customer A',
          'Items.code': 'P1',
          'Items.name': 'Product One',
          'Items.CustomerCode': 'C1',
        },
        {
          'Customer.code': 'C1',
          'Customer.name': 'Customer A',
          'Items.code': 'P2',
          'Items.name': 'Product Two',
          'Items.CustomerCode': 'C1',
        },
      ];

      const schema: HydrationSchemaNode<Models> = {
        model: 'Customer',
        children: [{ model: 'Product', alias: 'Items' }],
      };

      expect(builder.hydrate(flat, schema)).toEqual([
        {
          code: 'C1',
          name: 'Customer A',
          Items: [
            { code: 'P1', name: 'Product One', CustomerCode: 'C1' },
            { code: 'P2', name: 'Product Two', CustomerCode: 'C1' },
          ],
        },
      ]);
    });

    it('hydrates nested with distinct aliases on each level (Items & Skus)', () => {
      // declare extra aliases for nested relation
      builder
        .associate('Customer', (ab) => ab.hasMany('Product', 'Items'))
        .associate('Product', (ab) => ab.hasMany('Edition', 'Skus'));

      const flat = [
        {
          'Customer.code': 'C1',
          'Customer.name': 'Customer A',
          'Items.code': 'P1',
          'Items.name': 'Product One',
          'Items.CustomerCode': 'C1',
          'Skus.code': 'E1',
          'Skus.name': 'Standard',
          'Skus.ProductCode': 'P1',
        },
        {
          'Customer.code': 'C1',
          'Customer.name': 'Customer A',
          'Items.code': 'P1',
          'Items.name': 'Product One',
          'Items.CustomerCode': 'C1',
          'Skus.code': 'E2',
          'Skus.name': 'Pro',
          'Skus.ProductCode': 'P1',
        },
      ];

      const schema: HydrationSchemaNode<Models> = {
        model: 'Customer',
        children: [
          {
            model: 'Product',
            alias: 'Items',
            children: [{ model: 'Edition', alias: 'Skus' }],
          },
        ],
      };

      expect(builder.hydrate(flat, schema)).toEqual([
        {
          code: 'C1',
          name: 'Customer A',
          Items: [
            {
              code: 'P1',
              name: 'Product One',
              CustomerCode: 'C1',
              Skus: [
                {
                  code: 'E1',
                  name: 'Standard',
                  ProductCode: 'P1',
                },
                { code: 'E2', name: 'Pro', ProductCode: 'P1' },
              ],
            },
          ],
        },
      ]);
    });
  });

  // ---------- columns API ----------

  describe('hydrate column aliases', () => {
    let customBuilder: HydraModeler<any>;
    beforeEach(() => {
      customBuilder = new HydraModeler(builder).addModels((m) =>
        m.add('CustomModel', {
          code: {},
          fullName: {},
          dateOfBirth: {},
        }),
      );
    });

    it('model with explicit alias equal to model name', () => {
      const result = customBuilder.columns('Customer', 'Customer');
      expect(result).toEqual([
        '"Customer"."code" as "Customer.code"',
        '"Customer"."name" as "Customer.name"',
        '"Customer"."AddressCode" as "Customer.AddressCode"',
      ]);
    });

    it('use existing alias', () => {
      const result = customBuilder.columns('Customer', 'c');
      expect(result).toEqual([
        '"c"."code" as "c.code"',
        '"c"."name" as "c.name"',
        '"c"."AddressCode" as "c.AddressCode"',
      ]);
    });

    it('use processor to convert to UPPERCASE', () => {
      const processor = (input: string) => input.toUpperCase();
      const result = customBuilder.columns(processor, 'Customer', 'Customer');
      expect(result).toEqual([
        '"CUSTOMER"."CODE" AS "CUSTOMER.CODE"',
        '"CUSTOMER"."NAME" AS "CUSTOMER.NAME"',
        '"CUSTOMER"."ADDRESSCODE" AS "CUSTOMER.ADDRESSCODE"',
      ]);
    });

    it('use processor to convert PascalCase to snake_case', () => {
      const pascalToSnake = (input: string): string =>
        input.replace(/"([^"]+)"/g, (_m, inner: string) => {
          const snake = inner
            .split('.')
            .map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
            .join('.');
          return `"${snake}"`;
        });

      const result = customBuilder.columns(pascalToSnake, 'CustomModel', 'CustomModel');
      expect(result).toEqual([
        '"custom_model"."code" as "custom_model.code"',
        '"custom_model"."full_name" as "custom_model.full_name"',
        '"custom_model"."date_of_birth" as "custom_model.date_of_birth"',
      ]);
    });
  });

  describe('test edge-cases', () => {
    let nature: HydraModeler<any>;
    beforeEach(() => {
      nature = new HydraModeler<{
        animal: { id: number; name: string };
      }>().addModels((m) => m.add('animal', { id: {}, name: {} }));
    });
    it('throws when not all rows have same structure', () => {
      const flat = [
        {
          'Animal.id': 1,
          'Animal.name': 'Dog',
        },
        {
          'Animal.name': 'Cat',
        },
      ];
      expect(() => nature.hydrate(flat, { model: 'animal', alias: 'Animal' })).toThrow(
        AllFlatRowsMustHaveSamePropertiesError,
      );
    });

    it('throws if any model primary key is missing', () => {
      const flat = [
        {
          'Animal.name': 'Dog',
        },
        {
          'Animal.name': 'Cat',
        },
      ];
      expect(() => nature.hydrate(flat, { model: 'animal', alias: 'Animal' })).toThrow(
        PrefixedPrimaryKeyNotFoundInFlatRowsError,
      );
    });
  });
});
