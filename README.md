Here’s a clean **README.md** you can drop into your repo — it includes your logo, badges, an introduction, install instructions, usage notes, and purpose of Hydra-Modeler:

````markdown
<p align="center">
  <img src=".github/assets/hydra-modeler-logo.jpg" alt="Hydra Modeler" width="200"/>
</p>

<h1 align="center">Hydra-Modeler</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/hydra-modeler">
    <img src="https://img.shields.io/npm/v/hydra-modeler.svg" alt="npm version"/>
  </a>
  <a href="https://github.com/mike35x95x1/hydra-modeler/actions">
    <img src="https://github.com/mike35x95x1/hydra-modeler/actions/workflows/ci.yml/badge.svg" alt="CI status"/>
  </a>
</p>

---

## Introduction

**Hydra-Modeler** is a **database-agnostic**, **framework-independent**, **zero-dependency** TypeScript library for modeling and hydrating complex association trees from flat query results.

It is designed to work with any SQL builder (Kysely, Knex, Sequelize, raw SQL) or even external APIs that return flat row structures. Hydra-Modeler lets you define models, attributes, and associations (belongsTo, hasOne, hasMany, belongsToMany) and then transform flat rows into deeply nested objects — much like an ORM hydration step, but **without ORM lock-in**.

---

## Features

- ✅ **Database agnostic** — works with any query builder or raw SQL
- ✅ **Framework independent** — use it in Node.js, NestJS, Express, or standalone
- ✅ **Zero runtime dependencies** — just TypeScript types and a small runtime
- ✅ **Typed models and associations** — get type safety for attributes and relationships
- ✅ **Explicit schema control** — no “magic” conventions, associations are always declared
- ✅ **Unit tested** — over 20 tests ensure reliability and correctness

---

## Installation

```bash
npm install hydra-modeler
```
````

or with yarn:

```bash
yarn add hydra-modeler
```

---

## Quick Start

```ts
import { HydraModeler } from 'hydra-modeler';

type Models = {
  Customer: { code: string; name: string; AddressCode: string };
  Address: { code: string; street: string };
};

const builder = new HydraModeler<Models>()
  .addModels((mb) =>
    mb
      .add('Customer', { code: {}, name: {}, AddressCode: {} })
      .add('Address', { code: {}, street: {} }),
  )
  .associate('Customer', (ab) => ab.belongsTo('Address'));

const flatRows = [
  {
    'Customer.code': 'C1',
    'Customer.name': 'Alice',
    'Customer.AddressCode': 'A1',
    'Address.code': 'A1',
    'Address.street': 'Main Street',
  },
];

const schema = {
  model: 'Customer',
  children: [{ model: 'Address' }],
};

const hydrated = builder.hydrate(flatRows, schema);
console.log(JSON.stringify(hydrated, null, 2));
```

Output:

```json
[
  {
    "code": "C1",
    "name": "Alice",
    "AddressCode": "A1",
    "Address": {
      "code": "A1",
      "street": "Main Street"
    }
  }
]
```

---

## Purpose

Hydra-Modeler solves the problem of **reconstructing nested structures** from flat row results:

- Query builders (e.g., Kysely) and SQL joins return denormalized rows
- You often want a **tree of objects** that matches your domain model
- ORMs solve this but lock you into heavy abstractions — Hydra-Modeler gives you **just the hydration** part

This makes it ideal for:

- building **query-driven APIs**
- handling **reporting and projections**
- or enriching **GraphQL resolvers** with deeply nested results

---

## Development & Tests

Clone and install:

```bash
git clone https://github.com/mike35x95x1/hydra-modeler.git
cd hydra-modeler
npm install
```

Run lint and tests:

```bash
npm run lint
npm test
```

Hydra-Modeler is covered by unit tests to ensure correctness across different association types.

---

## License

MIT © \[Your Name]

```

---

👉 Notes:
- Put your logo file in `docs/hydra-modeler-logo.png` (or `assets/` if you prefer).
- Once you publish to npm, the version badge will update automatically.
- If your CI workflow isn’t named `ci.yml`, update the badge URL accordingly.

Would you like me to also generate a **docs/USAGE.md** file with more advanced examples (hasMany, belongsToMany, etc.) so you can link it from the README?
```
