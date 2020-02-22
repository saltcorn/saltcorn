class Attribute {
  constructor(o) {}
}

class Type {
  name = "";
  attributes = {};
}

class String extends Type {
  name = "String";
}

class Integer extends Type {
  name = "Integer";
  attributes = [{ name: "max", type: "Integer", required: false }];
}
