
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || 'Today';
        const rawPicks = searchParams.get('picks');

        if (!rawPicks) {
            return new Response('Missing picks data', { status: 400 });
        }

        const picks = JSON.parse(rawPicks);

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#000000',
                        backgroundImage: 'radial-gradient(circle at 25px 25px, #333 2%, transparent 0%), radial-gradient(circle at 75px 75px, #333 2%, transparent 0%)',
                        backgroundSize: '100px 100px',
                        color: 'white',
                        fontFamily: 'sans-serif',
                        padding: '40px',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
                        <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: '-0.05em', background: 'linear-gradient(to right, #ffcc00, #ff9900)', backgroundClip: 'text', color: 'transparent' }}>
                            FUNMO TIPS
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#666', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                            Top Picks • {date}
                        </div>
                    </div>

                    {/* Cards Container */}
                    <div style={{ display: 'flex', gap: '30px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {picks.map((pick: any, i: number) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    backgroundColor: '#111',
                                    border: '1px solid #333',
                                    borderRadius: '20px',
                                    padding: '30px',
                                    width: '450px',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                }}
                            >
                                {/* Teams */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', maxWidth: '180px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{pick.home}</div>
                                    <div style={{ fontSize: 20, color: '#444', fontWeight: 900 }}>VS</div>
                                    <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', maxWidth: '180px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'right' }}>{pick.away}</div>
                                </div>

                                {/* Divider */}
                                <div style={{ width: '100%', height: '1px', backgroundColor: '#333', marginBottom: '20px' }} />

                                {/* Prediction */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: 16, color: '#666', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>Prediction</span>
                                        <span style={{ fontSize: 28, color: '#ffcc00', fontWeight: 900 }}>{pick.tip}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontSize: 16, color: '#666', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>Odds</span>
                                        <span style={{ fontSize: 28, color: '#fff', fontWeight: 900 }}>{pick.odds}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div style={{ position: 'absolute', bottom: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: 20, color: '#444', fontWeight: 500 }}>funmotips.africa</div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            },
        );
    } catch (e: any) {
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}
