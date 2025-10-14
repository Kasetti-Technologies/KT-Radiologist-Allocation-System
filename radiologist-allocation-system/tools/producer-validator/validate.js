import fs from "fs-extra";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import chalk from "chalk";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const schemaPath = "../../schemas/radiology.ticket.v1.json";
const validPath = "../../schemas/examples/valid.json";
const invalidPath = "../../schemas/examples/invalid.json";

async function validateJSON(schema, filePath) {
  const data = await fs.readJSON(filePath);
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    console.log(chalk.green(`✅ ${filePath} is valid!`));
  } else {
    console.log(chalk.red(`❌ ${filePath} failed validation:`));
    console.log(validate.errors);
  }
}

async function main() {
  const schema = await fs.readJSON(schemaPath);

  // Compile schema once
  ajv.addSchema(schema);

  await validateJSON(schema, validPath);
  await validateJSON(schema, invalidPath);
}

await main();
