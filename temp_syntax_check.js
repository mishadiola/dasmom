const fs = require("fs"); const code = fs.readFileSync("src/services/patientservice.js", "utf8"); console.log(new Function(code));
