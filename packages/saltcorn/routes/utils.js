//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = nm => nm.replace(/\b@[a-zA-Z][a-zA-Z0-9]*\b/g, "");
const type_to_input = (t) => {
    switch (t) {
        case 'text':
            return 'text';
        case 'int':
                return 'number';
        default:
                return 'text';;
    }
}

module.exports = {
  sqlsanitize,type_to_input
};
