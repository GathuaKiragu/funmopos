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

        const siteUrl = 'https://odds.funmo.africa';
        const logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://funmotips.africa'}/funmo-logo.png`;

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        backgroundColor: '#050505',
                        backgroundImage: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #000 70%)',
                        color: 'white',
                        fontFamily: 'Inter, sans-serif',
                        padding: '40px',
                        position: 'relative',
                    }}
                >
                    {/* Background Grid Pattern */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                        opacity: 0.2,
                        zIndex: 0
                    }} />

                    {/* Header */}
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', padding: '0 20px', zIndex: 10 }}>
                        {/* Branding Left */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <img src={logoUrl} width="90" height="90" style={{ objectFit: 'contain' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 20, letterSpacing: '0.3em', color: '#EAB308', fontWeight: 700 }}>PREMIUM</span>
                                <span style={{ fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1 }}>FUNMO TIPS</span>
                            </div>
                        </div>

                        {/* Date Right */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', fontSize: 16, backgroundColor: '#333', padding: '5px 15px', borderRadius: '20px', color: '#aaa', fontWeight: 600, marginBottom: '5px' }}>
                                DAILY INSIGHTS
                            </div>
                            <span style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{date}</span>
                        </div>
                    </div>

                    {/* Separator */}
                    <div style={{ display: 'flex', width: '100%', height: '2px', background: 'linear-gradient(to right, transparent, #EAB308, transparent)', marginBottom: '40px', zIndex: 10 }} />

                    {/* Match List Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '25px', alignItems: 'center', zIndex: 10 }}>
                        {picks.map((pick: any, i: number) => {
                            const confidence = pick.confidence || 75; // Default if missing
                            const isBanker = confidence >= 85;
                            const isHot = confidence >= 70 && confidence < 85;
                            const barColor = confidence >= 80 ? '#22c55e' : (confidence >= 60 ? '#EAB308' : '#ef4444');

                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        width: '100%',
                                        height: '110px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.03)', // Glass effect
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '24px',
                                        alignItems: 'center',
                                        padding: '0 30px',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Banker/Hot Badge Overlay */}
                                    {isBanker && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            backgroundColor: '#EAB308',
                                            color: '#000',
                                            fontSize: 12,
                                            fontWeight: 800,
                                            padding: '4px 12px',
                                            borderBottomRightRadius: '12px'
                                        }}>
                                            ★ BANKER
                                        </div>
                                    )}
                                    {!isBanker && isHot && (
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            backgroundColor: '#ef4444',
                                            color: '#fff',
                                            fontSize: 12,
                                            fontWeight: 800,
                                            padding: '4px 12px',
                                            borderBottomRightRadius: '12px'
                                        }}>
                                            🔥 HOT
                                        </div>
                                    )}

                                    {/* Match Teams */}
                                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '20px' }}>
                                        <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#fff', width: '280px', justifyContent: 'flex-end', textAlign: 'right' }}>
                                            {pick.home}
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            width: '40px',
                                            height: '40px',
                                            backgroundColor: '#222',
                                            color: '#EAB308',
                                            borderRadius: '50%',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 14,
                                            fontWeight: 900,
                                            border: '1px solid #444'
                                        }}>
                                            VS
                                        </div>

                                        <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#fff', width: '280px', justifyContent: 'flex-start', textAlign: 'left' }}>
                                            {pick.away}
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ width: '1px', height: '60%', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 20px' }} />

                                    {/* Prediction & Confidence */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '25px', minWidth: '280px', justifyContent: 'flex-end' }}>

                                        {/* Prediction */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <div style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', fontWeight: 600 }}>Prediction</div>
                                            <div style={{ fontSize: 22, color: '#EAB308', fontWeight: 800 }}>{pick.tip}</div>
                                            <div style={{ fontSize: 13, color: '#aaa', fontWeight: 500 }}>@{pick.odds}</div>
                                        </div>

                                        {/* Confidence Meter (Linear) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100px' }}>
                                            <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, marginBottom: '4px' }}>
                                                {confidence}% Win Prob
                                            </div>
                                            <div style={{ display: 'flex', width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    width: `${confidence}%`,
                                                    height: '100%',
                                                    backgroundColor: barColor
                                                }} />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', marginTop: 'auto', width: '100%', justifyContent: 'center', paddingTop: '20px', zIndex: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#111', padding: '10px 25px', borderRadius: '30px', border: '1px solid #333' }}>
                            <span style={{ fontSize: 18, color: '#888', marginRight: '10px' }}>Join the winners at</span>
                            <span style={{ fontSize: 18, color: '#EAB308', fontWeight: 700 }}>odds.funmo.africa</span>
                        </div>
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
