export async function stat(path: string, opts?: any) {}

export async function readFile(path: string, options?: any): Promise<any> {}

export async function writeFile(
  file: string,
  data: string,
  options?: any
): Promise<void> {}

export async function mkdir(
  path: string,
  options: any
): Promise<string | undefined> {
  return;
}

export async function unlink(path: string): Promise<void> {}
