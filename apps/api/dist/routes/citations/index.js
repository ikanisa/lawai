import { cloneCitationsData } from './data.js';
export async function registerCitationsRoutes(app, _ctx) {
    app.get('/citations', async () => cloneCitationsData());
}
