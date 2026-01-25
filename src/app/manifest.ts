import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Funmo Tips',
        short_name: 'FunmoTips',
        description: 'Premium football analytics and betting predictions powered by AI.',
        start_url: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#EAB308',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
            {
                src: '/icon.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/apple-icon.png',
                sizes: '180x180',
                type: 'image/png',
            },
        ],
    };
}
