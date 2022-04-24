export function createReadStream(path: string, options: any) {}

export function writeFileSync(file: string, data: string, options?: any): void {
  console.log("'fs.writeFileSync' does not exist in a mobile enviroment");
}

export function readdirSync(file: string, options?: any): string[] {
  console.log("'fs.readdirSync' does not exist in a mobile enviroment");
  return [];
}
