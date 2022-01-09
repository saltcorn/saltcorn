export interface AbstractRole {
  id: number;
  role: string;
}

export type RoleCfg = {
  id: number;
  role: string;
};

export type RolePack = {} & RoleCfg;
