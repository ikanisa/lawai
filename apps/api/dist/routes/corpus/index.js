export async function registerCorpusRoutes(app, _ctx) {
    app.get('/corpus', async () => cloneCorpusDashboardResponse());
}
