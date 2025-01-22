interface db {
  // @line 5 @path ../original/model.ts
	user?: Partial<Model>;
	[key: string]: any;
}

interface Model {
  [key: string]: any;
}

export { db, Model };