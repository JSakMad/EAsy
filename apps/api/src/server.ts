import { config } from "./config.js";
import { createApp } from "./app.js";

createApp().listen(config.PORT, () => console.log(`Easy A Finder API listening on port ${config.PORT}`));
