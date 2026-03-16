import { runAllEndpoints } from "./all-endpoints";

runAllEndpoints().catch((error) => {
  console.error(error);
  process.exit(1);
});
