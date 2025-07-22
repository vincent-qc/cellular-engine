import { dockerEngine } from "./services/dockerEngine.js";


console.log('🧪 Testing @cellular-ai/engine exports...');

const test = async () => {
  console.log("Creating Engine");
  const engine = await dockerEngine({
    dir: "./",
    model: "flash",
    debug: false,
  });

  console.log("Engine created!");
  await engine.init();
  console.log("Engine initialized");
  await engine.create();
  console.log("Container created");
}

test();