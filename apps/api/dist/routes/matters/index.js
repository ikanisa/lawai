import { cloneMattersData } from './data.js';
export async function registerMattersRoutes(app, _ctx) {
    app.get('/matters', async () => cloneMattersData());
}
