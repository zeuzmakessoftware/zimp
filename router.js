import { compileZimpFile } from './index';
import path from 'path';
import fs from 'fs';

export default function zimpPlugin() {
    return {
        name: 'router',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                let url = req.url;
                let zimpFilePath;

                if (url.startsWith('/public') || url.endsWith('.js') || url.endsWith('.css')) {
                    return next();
                }

                if (!url.endsWith('/') && !url.includes('.')) {
                    url += '/';
                    res.writeHead(302, { Location: url });
                    res.end();
                    return;
                }

                if (url.endsWith('/')) {
                    zimpFilePath = path.join(process.cwd(), 'src', url, 'index.zimp');
                } else if (url.endsWith('.zimp')) {
                    zimpFilePath = path.join(process.cwd(), 'src', url);
                } else {
                    return next();
                }

                const serveIndexHtml = (compiledJs) => {
                    const indexPath = path.join(process.cwd(), 'public', 'index.html');
                    if (fs.existsSync(indexPath)) {
                        let htmlContent = fs.readFileSync(indexPath, 'utf-8');
                        htmlContent = htmlContent.replace(
                            '<script type="module" src="/main.js"></script>',
                            `<script type="module">${compiledJs}</script>`
                        );
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'text/html');
                        res.end(htmlContent);
                    } else {
                        res.statusCode = 500;
                        res.end('Index HTML file not found.');
                        console.error('Index HTML file not found.');
                    }
                };

                if (fs.existsSync(zimpFilePath)) {
                    try {
                        const compiledJs = compileZimpFile(zimpFilePath);
                        serveIndexHtml(compiledJs);
                    } catch (error) {
                        res.statusCode = 500;
                        res.end('Error compiling Zimp file.');
                        console.error(`Error compiling Zimp file: ${zimpFilePath}`, error);
                    }
                } else {
                    res.statusCode = 404;
                    res.end('Zimp file not found.');
                    console.error(`Zimp file not found: ${zimpFilePath}`);
                }
            });
        }
    };
}
