interface db {
  // File://../original/model.ts:5
	user?: Partial<Model>;
	[key: string]: any;
}

interface Model {
  [key: string]: any;
}

export { db, Model };