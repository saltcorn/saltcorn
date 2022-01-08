export interface AbstractRole {
  id: number;
  role: AbstractRole;
}

export type RoleCfg = {
  id: number;
  role: any;
};

export type RolePack = {} & RoleCfg;
