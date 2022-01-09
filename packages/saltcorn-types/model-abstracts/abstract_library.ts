export type LibraryCfg = {
  id: number;
  name: string;
  icon: string;
  layout: string | any;
};

export type LibraryPack = {} & LibraryCfg;
