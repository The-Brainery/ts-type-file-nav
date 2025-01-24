# typescript-file-navigation README

This is the README for your extension "typescript-file-navigation". After writing up a brief description, we recommend including the following sections.

## How to use

1. In your type definition add a comment like so above the attribute / type that you want to redirect.
```ts
    // File://../original/file.ts:<LINE_NUMBER>
```

ex.

```ts
interface db {
    // File://../original/db.ts:5
	user?: Partial<Model>;
	[key: string]: any;
}

interface Model {
  [key: string]: any;
}

export { db, Model };

```

2. Now when you CMD + Click it will navigate to the source file / line number
