import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Activity,
  DollarSign,
  Calendar as CalendarIcon,
  LogOut,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  ChevronDown,
  Search,
  Sparkles,
} from 'lucide-react';

const KNOWN_MT5_SERVERS = [
  { broker: 'Deriv Limited', server: 'Deriv-Server', type: 'Live' },
  { broker: 'Deriv Limited', server: 'Deriv-Server-02', type: 'Live' },
  { broker: 'Deriv Limited', server: 'Deriv-Demo', type: 'Demo' },
  { broker: 'Exness Technologies Ltd', server: 'Exness-MT5Real', type: 'Live' },
  { broker: 'Exness Technologies Ltd', server: 'Exness-MT5Real2', type: 'Live' },
  { broker: 'Exness Technologies Ltd', server: 'Exness-MT5Real3', type: 'Live' },
  { broker: 'Exness Technologies Ltd', server: 'Exness-MT5Real7', type: 'Live' },
  { broker: 'Exness Technologies Ltd', server: 'Exness-MT5Trial', type: 'Demo' },
  { broker: 'FTMO Global Markets', server: 'FTMO-Server', type: 'Prop / Live' },
  { broker: 'FTMO Global Markets', server: 'FTMO-Server2', type: 'Prop / Live' },
  { broker: 'FTMO Global Markets', server: 'FTMO-Server3', type: 'Prop / Live' },
  { broker: 'FTMO Global Markets', server: 'FTMO-Demo', type: 'Demo' },
  { broker: 'FundingPips', server: 'FundingPips-Trade', type: 'Prop / Live' },
  { broker: 'FundingPips', server: 'FundingPips-Demo', type: 'Demo' },
  { broker: 'IC Markets (SC)', server: 'ICMarketsSC-MT5', type: 'Live' },
  { broker: 'IC Markets (SC)', server: 'ICMarketsSC-MT5-2', type: 'Live' },
  { broker: 'IC Markets (SC)', server: 'ICMarketsSC-Demo', type: 'Demo' },
  { broker: 'Scope Markets', server: 'ScopeMarkets-Live', type: 'Live' },
  { broker: 'Scope Markets', server: 'ScopeMarkets-Demo', type: 'Demo' },
];

const TRADING_VOTD_BANK = [
  {
    reference: 'Proverbs 21:5',
    theme: 'Planning & Discipline',
    paraphrase: 'Careful, unhurried planning leads to steady gains, while rushing into decisions invites loss.',
    tradingApplication: 'Wait for your session setup, liquidity sweep, and confirmation before risking capital.',
  },
  {
    reference: 'Proverbs 13:11',
    theme: 'Compounding vs. Hype',
    paraphrase: 'Wealth gained through shortcuts and reckless haste shrinks, whereas steady accumulation grows over time.',
    tradingApplication: 'Protect small, consistent base hits and avoid over-leveraging to force big days.',
  },
  {
    reference: 'James 1:5–6',
    theme: 'Clarity & Emotional Control',
    paraphrase: 'Ask for wisdom when uncertain, and avoid double-minded hesitation or reactive impulses.',
    tradingApplication: 'If a chart looks unclear or choppy, step aside rather than guessing mid-move.',
  },
  {
    reference: 'Proverbs 16:3',
    theme: 'Execution & Alignment',
    paraphrase: 'Commit your plans to steady purpose and your intentions will establish firm footing.',
    tradingApplication: 'Define invalidation, stop loss, and target before entering so emotions stay out of the trade.',
  },
  {
    reference: 'Ecclesiastes 11:2',
    theme: 'Risk & Diversification',
    paraphrase: 'Spread exposure wisely rather than concentrating everything in a single vulnerable spot.',
    tradingApplication: 'Cap per-trade risk and avoid stacking correlated positions during high-impact news.',
  },
  {
    reference: 'Galatians 6:9',
    theme: 'Patience & Consistency',
    paraphrase: 'Do not grow weary in doing what is right; harvest comes in due season if you do not quit.',
    tradingApplication: 'Stick to your journal review and risk rules even after a frustrating drawdown streak.',
  },
  {
    reference: 'Proverbs 25:28',
    theme: 'Self-Command',
    paraphrase: 'A person without self-control is like a city with broken walls—open to every breach.',
    tradingApplication: 'Enforce a daily loss limit and walk away after hitting your max loss or max trades.',
  },
  {
    reference: 'Luke 14:28',
    theme: 'Position Sizing & Cost',
    paraphrase: 'Sit down first and calculate the full cost before starting a project you cannot finish.',
    tradingApplication: 'Size lots from your stop distance and account risk—never pick lot size first.',
  },
  {
    reference: 'Proverbs 14:23',
    theme: 'Preparation & Process',
    paraphrase: 'Hard work and genuine preparation bring real value, whereas mere talk leaves you empty.',
    tradingApplication: 'Backtest, journal, and mark key levels before market open instead of chasing candles.',
  },
  {
    reference: '1 Corinthians 16:13–14',
    theme: 'Alertness & Composure',
    paraphrase: 'Stay alert, stand firm in conviction, act with strength, and keep your spirit grounded.',
    tradingApplication: 'Keep your posture calm during CPI, NFP, or FOMC volatility and stick to your rules.',
  },
  {
    reference: 'Proverbs 27:12',
    theme: 'Risk Awareness',
    paraphrase: 'The prudent see danger ahead and take cover, while the careless walk straight into trouble.',
    tradingApplication: 'Respect spreads, session rollovers, and major news spikes instead of trading blindly.',
  },
  {
    reference: 'Psalm 37:7',
    theme: 'Patience Under Pressure',
    paraphrase: 'Be still and wait patiently without fretting when others seem to move faster.',
    tradingApplication: 'Let price reach your order block or fair value gap rather than forcing entries early.',
  },
  {
    reference: 'Proverbs 12:11',
    theme: 'Focus on Craft',
    paraphrase: 'Working your own ground brings plenty, while chasing empty fantasies shows poor judgment.',
    tradingApplication: 'Master one or two instruments and setups rather than jumping across random pairs.',
  },
  {
    reference: 'Proverbs 10:9',
    theme: 'Rule Integrity',
    paraphrase: 'Whoever walks with integrity walks securely, while crooked paths get exposed.',
    tradingApplication: 'Follow your trading plan on every single trade—no exceptions for boredom or FOMO.',
  },
  {
    reference: 'Proverbs 24:3–4',
    theme: 'Structure & Insight',
    paraphrase: 'A house is built by wisdom and established by understanding, and its rooms fill with quality.',
    tradingApplication: 'Build your edge on repeatable data and clear rules rather than random chart patterns.',
  },
  {
    reference: 'Proverbs 11:14',
    theme: 'Sound Counsel & Review',
    paraphrase: 'Without guidance a plan can falter, while careful review and counsel bring safety.',
    tradingApplication: 'Review your weekly trade log objectively to spot recurring mistakes early.',
  },
  {
    reference: 'Proverbs 19:2',
    theme: 'Deliberate Speed',
    paraphrase: 'Acting without knowledge is not good, and moving too fast makes a person miss the mark.',
    tradingApplication: 'Pause and check higher-timeframe context before pulling the trigger.',
  },
  {
    reference: 'Proverbs 4:25–26',
    theme: 'Clear Eyes & Level Path',
    paraphrase: 'Look straight ahead with fixed focus and make a level path for your steps.',
    tradingApplication: 'Ignore social media hype and focus strictly on your own price action and risk.',
  },
  {
    reference: 'Proverbs 16:9',
    theme: 'Adaptability',
    paraphrase: 'A person maps out their route, yet daily conditions direct where each step lands.',
    tradingApplication: 'Have a pre-market bias, but adapt immediately if market structure shifts.',
  },
  {
    reference: 'Proverbs 28:20',
    theme: 'Steady Growth Over Haste',
    paraphrase: 'A faithful, steady worker abounds in blessing, while one eager to get rich fast invites trouble.',
    tradingApplication: 'Treat trading as a long-term skill compounder, not an overnight lottery.',
  },
  {
    reference: 'Ecclesiastes 5:12',
    theme: 'Peace of Mind',
    paraphrase: 'Moderate, well-managed effort lets you rest peacefully, while excess worry robs your peace.',
    tradingApplication: 'Keep risk small enough that open positions never disrupt your sleep or focus.',
  },
  {
    reference: 'Proverbs 17:27',
    theme: 'Restraint & Calm',
    paraphrase: 'Whoever restrains their words has knowledge, and one who stays cool has understanding.',
    tradingApplication: 'Avoid revenge trading right after a stopped-out position—take a breather.',
  },
  {
    reference: 'Proverbs 29:11',
    theme: 'Temper Control',
    paraphrase: 'Letting every frustration spill out all at once is reckless; holding back brings calm.',
    tradingApplication: 'Step away from the terminal whenever frustration or anger rises.',
  },
  {
    reference: 'Matthew 7:24–25',
    theme: 'Strong Foundation',
    paraphrase: 'Building on solid rock withstands storms and floods, while weak foundations collapse.',
    tradingApplication: 'Rely on strict risk management and backtested rules to survive volatile weeks.',
  },
  {
    reference: 'Proverbs 3:21',
    theme: 'Sound Judgment',
    paraphrase: 'Hold onto sound judgment and discernment, and never let them slip out of sight.',
    tradingApplication: 'Pass on low-probability A-minus setups so your capital stays ready for A-plus ones.',
  },
  {
    reference: 'Proverbs 15:22',
    theme: 'Thorough Preparation',
    paraphrase: 'Plans fail for lack of counsel, while careful deliberation gives them strength.',
    tradingApplication: 'Write out entry criteria, stop placement, and take-profit logic before entering.',
  },
  {
    reference: 'Proverbs 20:13',
    theme: 'Active Engagement',
    paraphrase: 'Sleeping through your opportunities brings lack, while staying awake and engaged brings plenty.',
    tradingApplication: 'Show up prepared during your best trading hours and log every session.',
  },
  {
    reference: 'Proverbs 18:15',
    theme: 'Continuous Learning',
    paraphrase: 'A discerning mind acquires knowledge, and attentive ears seek out insight.',
    tradingApplication: 'Study your winning and losing trades every week to sharpen pattern recognition.',
  },
  {
    reference: 'Psalm 27:14',
    theme: 'Courage & Patience',
    paraphrase: 'Wait with strength and courage; let your heart stay steady while waiting.',
    tradingApplication: 'Hold valid setups through normal noise without cutting winners short out of fear.',
  },
  {
    reference: 'Proverbs 22:3',
    theme: 'Foresight',
    paraphrase: 'The sensible see trouble coming and prepare, while the naive push ahead and pay the price.',
    tradingApplication: 'Check the economic calendar and spread conditions before placing orders.',
  },
  {
    reference: 'Hebrews 12:1',
    theme: 'Dropping Dead Weight',
    paraphrase: 'Lay aside every weight and distraction that easily trips you up so you can run the race.',
    tradingApplication: 'Remove cluttered indicators, distractions, and bad habits that cloud your execution.',
  },
  {
    reference: 'Philippians 4:6–7',
    theme: 'Inner Calm',
    paraphrase: 'Bring your anxieties to prayer instead of panic, and let steady peace guard your mind.',
    tradingApplication: 'Reset your mindset before a session so anxiety does not force bad entries.',
  },
  {
    reference: 'Proverbs 11:24–25',
    theme: 'Generosity & Balance',
    paraphrase: 'Open-handed wisdom flourishes, while hoarding tightly with fear can shrink results.',
    tradingApplication: 'Accept small planned losses willingly as the cost of doing business in the market.',
  },
  {
    reference: 'Proverbs 16:32',
    theme: 'Patience Over Force',
    paraphrase: 'Patience outperforms raw aggression, and self-mastery beats conquering a city.',
    tradingApplication: 'Winning in trading comes from patience and discipline, not forcing trades.',
  },
  {
    reference: 'Proverbs 8:11',
    theme: 'Value of Wisdom',
    paraphrase: 'Wisdom is better than precious jewels, and nothing you desire can compare with it.',
    tradingApplication: 'Prioritize learning risk control and market reading over chasing quick profits.',
  },
  {
    reference: 'Isaiah 30:15',
    theme: 'Quietness & Trust',
    paraphrase: 'In returning and rest lies safety; in quietness and confidence is strength.',
    tradingApplication: 'Stay calm and composed rather than overreacting to every tick on the chart.',
  },
  {
    reference: 'Proverbs 23:23',
    theme: 'Investing in Truth',
    paraphrase: 'Buy truth and do not sell it—along with wisdom, instruction, and understanding.',
    tradingApplication: 'Be honest with yourself in your journal; never fudge numbers or excuses.',
  },
  {
    reference: '2 Timothy 1:7',
    theme: 'Discipline & Sound Mind',
    paraphrase: 'A spirit of fear does not build strength; power, love, and a disciplined mind do.',
    tradingApplication: 'Trade with a calm, disciplined mind rather than fear of missing out or losing.',
  },
  {
    reference: 'Proverbs 13:4',
    theme: 'Effort Behind Desire',
    paraphrase: 'The slacker craves much and gets little, while diligent effort is richly satisfied.',
    tradingApplication: 'Pair profit goals with disciplined execution, journaling, and patience.',
  },
  {
    reference: 'Proverbs 6:6–8',
    theme: 'Proactive Habits',
    paraphrase: 'Look at the ant: without a boss or overseer, it prepares its store in season.',
    tradingApplication: 'Maintain your routine and risk discipline on your own without needing external push.',
  },
  {
    reference: 'Proverbs 10:4',
    theme: 'Diligence & Prosperity',
    paraphrase: 'A slack hand brings poverty, while a diligent hand builds wealth.',
    tradingApplication: 'Stay consistent with trade reviews, risk checks, and session preparation.',
  },
  {
    reference: 'Proverbs 1:5',
    theme: 'Sharpening Skill',
    paraphrase: 'The wise listen and add to their learning, and the discerning gain guidance.',
    tradingApplication: 'Treat every session as data to refine your edge rather than a personal test.',
  },
  {
    reference: 'Colossians 3:23',
    theme: 'Wholehearted Craft',
    paraphrase: 'Whatever task you take on, work at it wholeheartedly with excellence.',
    tradingApplication: 'Execute every trade cleanly according to plan, no matter the account size.',
  },
  {
    reference: 'Proverbs 12:1',
    theme: 'Welcoming Feedback',
    paraphrase: 'Whoever loves discipline loves knowledge, while hating correction is foolish.',
    tradingApplication: 'Let your drawdown data and losing trades correct your flaws without ego.',
  },
  {
    reference: 'Proverbs 15:1',
    theme: 'De-escalation',
    paraphrase: 'A gentle answer turns away wrath, while harsh words stir up anger.',
    tradingApplication: 'Cool down after a rough trade instead of escalating lot sizes to fight the market.',
  },
  {
    reference: 'Ecclesiastes 3:1',
    theme: 'Timing & Seasons',
    paraphrase: 'There is a right time for every activity and a season for every purpose under heaven.',
    tradingApplication: 'Trade active sessions with clear momentum; sit out dead or choppy hours.',
  },
  {
    reference: 'Proverbs 21:20',
    theme: 'Reserves & Prudence',
    paraphrase: 'Wise people store up choice resources, while the foolish squander what they have.',
    tradingApplication: 'Preserve account capital and drawdown buffer so you stay in the game.',
  },
  {
    reference: 'Proverbs 4:7',
    theme: 'Prioritizing Wisdom',
    paraphrase: 'Wisdom is supreme; get wisdom, and with all you get, get understanding.',
    tradingApplication: 'Understand why a setup works and where it fails before risking real money.',
  },
  {
    reference: '1 Peter 5:8',
    theme: 'Sobriety & Vigilance',
    paraphrase: 'Stay clear-headed and alert because threats prowl looking for an opening.',
    tradingApplication: 'Never trade tired, distracted, or emotionally compromised when risk is on the line.',
  },
  {
    reference: 'Proverbs 17:14',
    theme: 'Cutting Losses Early',
    paraphrase: 'Starting a quarrel is like letting out water; step away before conflict escalates.',
    tradingApplication: 'Honor your stop loss immediately—never turn a small planned loss into a disaster.',
  },
  {
    reference: 'Proverbs 14:15',
    theme: 'Skepticism & Verification',
    paraphrase: 'The gullible believe every word, while the prudent watch their step carefully.',
    tradingApplication: 'Verify setups on your own chart rules instead of blindly copying signals or hype.',
  },
  {
    reference: 'Psalm 46:10',
    theme: 'Stillness',
    paraphrase: 'Be still and recognize steady ground amidst turbulent waves.',
    tradingApplication: 'Pause before reacting to fast price spikes and check if your criteria are met.',
  },
  {
    reference: 'Proverbs 16:2',
    theme: 'Self-Honesty',
    paraphrase: 'All a person’s ways seem right in their own eyes, while motives are weighed beneath.',
    tradingApplication: 'Audit whether an entry came from your plan or from impulse and boredom.',
  },
  {
    reference: 'Proverbs 26:11',
    theme: 'Breaking Bad Loops',
    paraphrase: 'Repeating the exact same harmful mistake over and over wastes lessons learned.',
    tradingApplication: 'Fix one recurring mistake per week instead of repeating the same loss pattern.',
  },
  {
    reference: 'Romans 12:2',
    theme: 'Renewed Mindset',
    paraphrase: 'Do not conform to reactive patterns, but be transformed by renewing your mind.',
    tradingApplication: 'Replace impulsive retail habits with structured, process-driven execution.',
  },
  {
    reference: 'Proverbs 18:13',
    theme: 'Listening Before Acting',
    paraphrase: 'Answering before hearing the full picture is foolish and brings shame.',
    tradingApplication: 'Read the full multi-timeframe structure before jumping into a lower-timeframe entry.',
  },
  {
    reference: 'Ecclesiastes 7:8',
    theme: 'Finishing Strong',
    paraphrase: 'The end of a matter is better than its beginning, and patience beats pride.',
    tradingApplication: 'Judge your trading week by rule adherence and net growth, not one flashy trade.',
  },
  {
    reference: 'Proverbs 3:5–6',
    theme: 'Steadfast Direction',
    paraphrase: 'Trust deeply rather than leaning solely on fragile assumptions, and keep your path straight.',
    tradingApplication: 'Stay grounded in your tested process instead of panicking over short-term noise.',
  },
  {
    reference: 'Proverbs 10:19',
    theme: 'Less Noise, More Precision',
    paraphrase: 'Too much talk invites error, while holding back your tongue shows wisdom.',
    tradingApplication: 'Fewer, higher-quality trades beat constant overtrading every single week.',
  },
  {
    reference: 'Proverbs 19:21',
    theme: 'Purpose Prevails',
    paraphrase: 'Many plans exist in the human mind, but steady purpose endures.',
    tradingApplication: 'Let a clear, consistent trading objective guide your daily actions.',
  },
  {
    reference: '2 Peter 1:5–6',
    theme: 'Building Virtues',
    paraphrase: 'Add knowledge to faith, self-control to knowledge, and perseverance to self-control.',
    tradingApplication: 'Stack discipline, patience, and emotional control one habit at a time.',
  },
  {
    reference: 'Proverbs 11:3',
    theme: 'Integrity Guides',
    paraphrase: 'The integrity of the upright guides them, while duplicity destroys the unfaithful.',
    tradingApplication: 'Keep your risk and stop rules honest even when no one else is watching.',
  },
  {
    reference: 'Proverbs 24:27',
    theme: 'Prepare the Ground First',
    paraphrase: 'Finish your outside work and prepare your fields before building your household.',
    tradingApplication: 'Nail your risk rules, demo/backtest validation, and session prep before scaling.',
  },
  {
    reference: 'Psalm 119:105',
    theme: 'Light on the Path',
    paraphrase: 'Clear guidance acts as a lamp to your feet and a light on your path.',
    tradingApplication: 'Use clear key levels, session rules, and checklists to light your next step.',
  },
  {
    reference: 'Proverbs 13:20',
    theme: 'Healthy Environment',
    paraphrase: 'Walking with the wise makes you wise, while keeping reckless company harms you.',
    tradingApplication: 'Surround yourself with disciplined traders and structured study, not hype rooms.',
  },
  {
    reference: 'Proverbs 20:3',
    theme: 'Avoiding Unnecessary Fights',
    paraphrase: 'Stepping away from strife is honorable, while any fool can pick a fight.',
    tradingApplication: 'Do not fight strong market momentum—trade with structure or stay flat.',
  },
  {
    reference: 'Matthew 6:34',
    theme: 'One Day at a Time',
    paraphrase: 'Do not worry about tomorrow, for each day has enough troubles of its own.',
    tradingApplication: 'Focus on executing today’s session cleanly rather than stressing over distant targets.',
  },
  {
    reference: 'Proverbs 12:15',
    theme: 'Openness to Insight',
    paraphrase: 'A fool’s way seems right to them, while the wise listen to advice.',
    tradingApplication: 'Stay open to market feedback and review notes when price invalidates your thesis.',
  },
  {
    reference: 'Proverbs 14:8',
    theme: 'Discernment in Action',
    paraphrase: 'The wisdom of the prudent is to understand their way, while folly deceives.',
    tradingApplication: 'Know exact conditions for your setup before risking a single dollar.',
  },
  {
    reference: '1 Thessalonians 4:11',
    theme: 'Quiet, Orderly Work',
    paraphrase: 'Make it your ambition to live quietly, mind your own business, and work with your hands.',
    tradingApplication: 'Trade quietly and consistently in your own lane without comparing P&L to others.',
  },
  {
    reference: 'Proverbs 15:24',
    theme: 'Upward Path',
    paraphrase: 'The path of life leads upward for the wise, turning away from downward traps.',
    tradingApplication: 'Keep your risk caps firm so drawdowns stay shallow and recoverable.',
  },
  {
    reference: 'Proverbs 21:21',
    theme: 'Steadfast Pursuit',
    paraphrase: 'Whoever pursues righteousness and steadfastness finds life, honor, and stability.',
    tradingApplication: 'Pursue consistent rule execution over lucky homeruns.',
  },
  {
    reference: 'James 1:19–20',
    theme: 'Slow to Anger',
    paraphrase: 'Be quick to listen, slow to speak, and slow to anger, for anger does not produce right outcomes.',
    tradingApplication: 'Never enter a trade out of frustration after a loss or missed move.',
  },
  {
    reference: 'Proverbs 22:29',
    theme: 'Skilled Execution',
    paraphrase: 'Do you see someone skilled in their work? They will stand before leaders, not the obscure.',
    tradingApplication: 'Put in deliberate reps on chart reading and execution so skill compounds.',
  },
  {
    reference: 'Ecclesiastes 9:10',
    theme: 'Focused Effort',
    paraphrase: 'Whatever your hand finds to do, do it with all your might while the opportunity is yours.',
    tradingApplication: 'Stay sharp and focused during your active trading window, then log off cleanly.',
  },
  {
    reference: 'Proverbs 16:8',
    theme: 'Modest Gain With Integrity',
    paraphrase: 'Better a little with righteousness than great revenue with unrighteousness.',
    tradingApplication: 'A modest, rule-abiding green day beats a big rule-breaking trade every time.',
  },
  {
    reference: 'Proverbs 27:1',
    theme: 'Humility About Tomorrow',
    paraphrase: 'Do not boast about tomorrow, for you do not know what a single day may bring.',
    tradingApplication: 'Never assume a trade or day is guaranteed—always protect downside risk.',
  },
  {
    reference: 'Proverbs 10:14',
    theme: 'Storing Knowledge',
    paraphrase: 'The wise store up knowledge, while the mouth of a fool invites ruin.',
    tradingApplication: 'Document lessons from every trade so your playbook gets smarter over time.',
  },
  {
    reference: 'Psalm 1:3',
    theme: 'Deeply Rooted',
    paraphrase: 'Like a tree planted by steady streams, it bears fruit in season and its leaves do not wither.',
    tradingApplication: 'Build deep foundational habits that hold steady through changing market regimes.',
  },
  {
    reference: 'Proverbs 17:22',
    theme: 'Healthy Mind & Body',
    paraphrase: 'A cheerful, healthy spirit is good medicine, while a crushed spirit drains strength.',
    tradingApplication: 'Protect your physical health, sleep, and mental energy—they fuel sharp decisions.',
  },
  {
    reference: 'Proverbs 18:10',
    theme: 'Strong Refuge',
    paraphrase: 'A strong tower offers protection where the righteous run and find safety.',
    tradingApplication: 'Let hard stop losses and daily max-loss limits act as your protective shield.',
  },
  {
    reference: 'Proverbs 20:18',
    theme: 'Plans Confirmed by Counsel',
    paraphrase: 'Establish plans by taking counsel, and wage strategy with wise guidance.',
    tradingApplication: 'Test and confirm your strategy rules with objective data before going live.',
  },
  {
    reference: '2 Corinthians 5:7',
    theme: 'Steady Conviction',
    paraphrase: 'Walk by steady conviction and trust rather than being shaken by every shifting sight.',
    tradingApplication: 'Trust your tested edge and risk rules even when short-term price action looks scary.',
  },
  {
    reference: 'Proverbs 13:16',
    theme: 'Acting With Knowledge',
    paraphrase: 'Every prudent person acts with knowledge, while fools flaunt their own folly.',
    tradingApplication: 'Only enter trades where you clearly understand risk, invalidation, and target.',
  },
  {
    reference: 'Proverbs 14:29',
    theme: 'Great Understanding',
    paraphrase: 'Whoever is slow to anger has great understanding, while a hasty temper magnifies folly.',
    tradingApplication: 'Patience and emotional composure are signs of real trading maturity.',
  },
  {
    reference: 'Proverbs 25:16',
    theme: 'Moderation',
    paraphrase: 'If you find honey, eat only what you need, lest you take too much and feel sick.',
    tradingApplication: 'Do not overtrade after a winning streak—lock in gains and protect your edge.',
  },
  {
    reference: '1 Corinthians 9:25',
    theme: 'Strict Training',
    paraphrase: 'Everyone competing in games exercises self-control in all things for a lasting prize.',
    tradingApplication: 'Train your discipline and risk control with the rigor of an athlete.',
  },
  {
    reference: 'Proverbs 12:24',
    theme: 'Diligent Hands Lead',
    paraphrase: 'Diligent hands will rule, while slackness leads to forced labor.',
    tradingApplication: 'Consistent preparation and discipline put you in control of your trading journey.',
  },
  {
    reference: 'Proverbs 15:19',
    theme: 'Clear Road vs. Thorns',
    paraphrase: 'The way of the lazy is hedged with thorns, while the path of the upright is a highway.',
    tradingApplication: 'Skipping prep and risk rules creates obstacles; clean process smooths the road.',
  },
  {
    reference: 'Proverbs 19:8',
    theme: 'Caring for Your Own Growth',
    paraphrase: 'Whoever gains wisdom loves their own soul; whoever keeps understanding prospers.',
    tradingApplication: 'Protect your capital and mindset—they are your most valuable trading assets.',
  },
  {
    reference: 'Psalm 90:17',
    theme: 'Establishing Your Work',
    paraphrase: 'May steady favor rest upon us and establish the work of our hands.',
    tradingApplication: 'Keep refining your craft consistently so your work becomes solid and repeatable.',
  },
  {
    reference: 'Proverbs 21:2',
    theme: 'Checking Intentions',
    paraphrase: 'All a person’s ways seem right in their own sight, yet motives are weighed carefully.',
    tradingApplication: 'Check whether you are entering from a valid setup or out of boredom and revenge.',
  },
  {
    reference: 'Proverbs 24:10',
    theme: 'Strength in Adversity',
    paraphrase: 'If you falter in times of trouble, your strength was small.',
    tradingApplication: 'Use small drawdowns to build resilience rather than abandoning your plan.',
  },
  {
    reference: 'Hebrews 10:35–36',
    theme: 'Endurance & Promise',
    paraphrase: 'Do not throw away your confidence, for you need endurance to receive what is promised.',
    tradingApplication: 'Stay patient through rough patches while holding fast to your proven process.',
  },
  {
    reference: 'Proverbs 11:1',
    theme: 'Honest Scales',
    paraphrase: 'Dishonest scales are an abomination, while accurate weights bring favor.',
    tradingApplication: 'Measure your risk, reward, and stats accurately—never distort your numbers.',
  },
  {
    reference: 'Proverbs 16:16',
    theme: 'Wisdom Over Gold',
    paraphrase: 'How much better to get wisdom than gold, and to get understanding than silver.',
    tradingApplication: 'Invest time in mastering risk management and execution before chasing bigger sizes.',
  },
  {
    reference: 'Proverbs 28:19',
    theme: 'Working Your Own Field',
    paraphrase: 'Those who work their land will have plenty of food, while chasing fantasies brings poverty.',
    tradingApplication: 'Stick to your own high-probability setups instead of chasing every rumor.',
  },
  {
    reference: 'James 3:17–18',
    theme: 'Peaceable, Reasonable Wisdom',
    paraphrase: 'Wisdom from above is pure, peaceable, gentle, and reasonable, bearing steady fruit.',
    tradingApplication: 'Keep your trading calm, objective, and reasonable rather than reactive and harsh.',
  },
  {
    reference: 'Proverbs 30:8–9',
    theme: 'Balanced Provision',
    paraphrase: 'Keep falsehood far from me and grant neither poverty nor reckless excess that causes forgetfulness.',
    tradingApplication: 'Keep position sizing balanced so neither fear nor greed distorts your judgment.',
  },
  {
    reference: 'Proverbs 1:7',
    theme: 'Beginning of Wisdom',
    paraphrase: 'Respect and reverence for wisdom’s source is the starting point of true knowledge.',
    tradingApplication: 'Start every trading session with humility and respect for the market’s power.',
  },
];

function getLocalDayNumber(dateObj) {
  return Math.floor(
    Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()) / 86400000
  );
}

function getReshuffledCycleVerse(bank, dayNumber) {
  const len = bank.length;
  if (len === 0) return null;

  const normalizedDay = Math.max(0, dayNumber);
  const cycleIndex = Math.floor(normalizedDay / len);
  const positionInCycle = ((normalizedDay % len) + len) % len;

  const indices = Array.from({ length: len }, (_, i) => i);
  let state = (cycleIndex + 1) * 2654435761;

  const nextRand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = len - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return bank[indices[positionInCycle]];
}

function classifyServerType(serverName = '') {
  const lower = serverName.toLowerCase();
  if (lower.includes('demo') || lower.includes('trial')) return 'Demo';
  if (lower.includes('ftmo') || lower.includes('funding') || lower.includes('prop')) return 'Prop / Live';
  return 'Live';
}

function BrokerServerDropdown({ value, onChange, onDropdownStateChange, required = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteServers, setRemoteServers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef(null);

  const setOpenState = useCallback(
    (nextOpen) => {
      setIsOpen(nextOpen);
      if (onDropdownStateChange) onDropdownStateChange(nextOpen);
    },
    [onDropdownStateChange]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpenState(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setOpenState]);

  useEffect(() => {
    const query = (value || '').trim();
    if (query.length < 1) {
      setRemoteServers([]);
      setOpenState(false);
      return;
    }
    setOpenState(true);
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke('mt5-sync', {
          body: { action: 'search-servers', query },
        });
        if (!error && Array.isArray(data?.results) && data.results.length > 0) {
          setRemoteServers(
            data.results.map((item) => ({
              broker: item.broker || 'MT5 Broker',
              server: item.server,
              type: item.type || classifyServerType(item.server),
            }))
          );
        }
      } catch {
        // Keep local suggestions if remote lookup isn't configured
      } finally {
        setIsSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [value, setOpenState]);

  const suggestions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return [];
    const merged = [...KNOWN_MT5_SERVERS];
    for (const r of remoteServers) {
      if (
        r?.server &&
        !merged.some((m) => m.server.toLowerCase() === String(r.server).toLowerCase())
      ) {
        merged.push({
          broker: r.broker || 'MT5 Broker',
          server: String(r.server),
          type: r.type || classifyServerType(String(r.server)),
        });
      }
    }
    return merged
      .filter(
        (item) =>
          item.server.toLowerCase().includes(q) ||
          item.broker.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [value, remoteServers]);

  useEffect(() => {
    setActiveIndex(0);
  }, [value, isOpen]);

  const handleSelect = (serverName) => {
    onChange(serverName);
    setOpenState(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(suggestions[activeIndex].server);
    } else if (e.key === 'Escape') {
      setOpenState(false);
    }
  };

  const showDropdown = isOpen && (value || '').trim().length >= 1 && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-zinc-400 mb-1">
        Broker Server
      </label>
      <div className="relative">
        <Server className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
        <input
          type="text"
          required={required}
          value={value}
          onFocus={() => {
            if ((value || '').trim().length >= 1) setOpenState(true);
          }}
          onChange={(e) => {
            const nextVal = e.target.value;
            onChange(nextVal);
            if (nextVal.trim().length >= 1) {
              setOpenState(true);
            } else {
              setOpenState(false);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Cosmo Markets..."
          autoComplete="off"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <Search
          className={`w-3.5 h-3.5 absolute right-3 top-2.5 pointer-events-none transition-colors ${
            isSearching ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'
          }`}
        />
      </div>
      {showDropdown && (
        <div
          role="listbox"
          aria-label="Broker server suggestions"
          className="mt-1.5 w-full max-h-[268px] overflow-y-auto space-y-1 rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-xl transition-all duration-200"
        >
          {suggestions.map((item, idx) => {
            const isHighlighted = idx === activeIndex;
            const isDemo = item.type.toLowerCase().includes('demo');
            const isProp = item.type.toLowerCase().includes('prop');
            return (
              <button
                key={`${item.broker}-${item.server}-${idx}`}
                type="button"
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(item.server)}
                className={`h-[48px] w-full rounded-lg border px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-colors ${
                  isHighlighted
                    ? 'border-emerald-400/30 bg-emerald-500/[0.09] text-white'
                    : 'border-zinc-800/80 bg-transparent hover:border-zinc-600 text-zinc-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-medium text-zinc-100 truncate">
                    {item.server}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{item.broker}</div>
                </div>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    isDemo
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                      : isProp
                      ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  }`}
                >
                  {item.type}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  // --- Auth & User Profile State ---
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // --- Cloud Data States ---
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState('');
  const [trades, setTrades] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSyncingMt5, setIsSyncingMt5] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // --- UI & Modal States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalSessionKey, setAccountModalSessionKey] = useState(0);
  const [isServerDropdownExpanded, setIsServerDropdownExpanded] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const accountDropdownRef = useRef(null);

  // --- VOTD (Dynamic Island) State ---
  const [isVotdExpanded, setIsVotdExpanded] = useState(false);
  const [hasSeenVotdToday, setHasSeenVotdToday] = useState(false);
  const votdIslandRef = useRef(null);

  // --- Add Account Form States ---
  const [enableMt5Sync, setEnableMt5Sync] = useState(true);
  const [mt5Login, setMt5Login] = useState('');
  const [mt5InvestorPassword, setMt5InvestorPassword] = useState('');
  const [mt5Server, setMt5Server] = useState('');
  const [accountCreating, setAccountCreating] = useState(false);
  const [accountError, setAccountError] = useState('');

  const resetAddAccountForm = useCallback(() => {
    setMt5Login('');
    setMt5InvestorPassword('');
    setMt5Server('');
    setAccountError('');
    setIsServerDropdownExpanded(false);
    setAccountModalSessionKey((prev) => prev + 1);
  }, []);

  const openAddAccountModal = useCallback(() => {
    setIsAccountDropdownOpen(false);
    resetAddAccountForm();
    setIsAccountModalOpen(true);
  }, [resetAddAccountForm]);

  useEffect(() => {
    if (isAccountModalOpen) {
      setMt5Login('');
      setMt5InvestorPassword('');
      setMt5Server('');
      setAccountError('');
      setIsServerDropdownExpanded(false);
    }
  }, [isAccountModalOpen]);

  useEffect(() => {
    if (!isAccountDropdownOpen) return;
    const handleOutsideClick = (event) => {
      if (!accountDropdownRef.current?.contains(event.target)) {
        setIsAccountDropdownOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsAccountDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountDropdownOpen]);

  // --- Clock & Calendar ---
  const [now, setNow] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const todayLocalStr = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [now]);

  const votdStorageKey = useMemo(() => {
    const scope = session?.user?.id || 'guest';
    return `etj_votd_seen_${scope}_${todayLocalStr}`;
  }, [session?.user?.id, todayLocalStr]);

  const localDayNumber = useMemo(() => getLocalDayNumber(now), [now]);

  const verseOfTheDay = useMemo(
    () => getReshuffledCycleVerse(TRADING_VOTD_BANK, localDayNumber),
    [localDayNumber]
  );

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(votdStorageKey) === '1';
      setHasSeenVotdToday(seen);
    } catch {
      setHasSeenVotdToday(false);
    }
  }, [votdStorageKey]);

  const handleToggleVotdIsland = useCallback(() => {
    setIsVotdExpanded((prev) => {
      const next = !prev;
      if (next && !hasSeenVotdToday) {
        setHasSeenVotdToday(true);
        try {
          window.localStorage.setItem(votdStorageKey, '1');
        } catch {
          // Ignore storage restrictions
        }
      }
      return next;
    });
  }, [hasSeenVotdToday, votdStorageKey]);

  useEffect(() => {
    if (!isVotdExpanded) return;
    const handleVotdOutside = (event) => {
      if (!votdIslandRef.current?.contains(event.target)) {
        setIsVotdExpanded(false);
      }
    };
    const handleVotdEscape = (event) => {
      if (event.key === 'Escape') setIsVotdExpanded(false);
    };
    document.addEventListener('mousedown', handleVotdOutside);
    document.addEventListener('keydown', handleVotdEscape);
    return () => {
      document.removeEventListener('mousedown', handleVotdOutside);
      document.removeEventListener('keydown', handleVotdEscape);
    };
  }, [isVotdExpanded]);

  // 1. Check & Listen for Auth Session across devices
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshAccounts = useCallback(async () => {
    const { data: accData } = await supabase
      .from('trading_accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (accData) setAccounts(accData);
    return accData || [];
  }, []);

  const refreshTrades = useCallback(async () => {
    const { data: tradeData } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (tradeData) setTrades(tradeData);
  }, []);

  // 2. Fetch User's Accounts & Trades from Supabase once logged in
  useEffect(() => {
    if (!session?.user) {
      setAccounts([]);
      setTrades([]);
      setActiveAccountId('');
      return;
    }
    const fetchCloudData = async () => {
      setDataLoading(true);
      const fetchedAccounts = await refreshAccounts();
      await refreshTrades();
      if (fetchedAccounts.length === 0) {
        resetAddAccountForm();
        setIsAccountModalOpen(true);
      } else {
        setActiveAccountId((prev) =>
          fetchedAccounts.some((a) => a.id === prev) ? prev : fetchedAccounts[0].id
        );
      }
      setDataLoading(false);
    };
    fetchCloudData();

    const channel = supabase
      .channel('trades-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades' },
        () => {
          refreshTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, refreshAccounts, refreshTrades, resetAddAccountForm]);

  // Live 1-second Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  // Trigger MT5 Cloud Sync for the active account + auto-update balance/equity
  const triggerMt5Sync = useCallback(
    async (targetAccountId, silent = false) => {
      if (!targetAccountId) return;
      setIsSyncingMt5(true);
      if (!silent) setSyncMessage('');
      const { data, error } = await supabase.functions.invoke('mt5-sync', {
        body: { action: 'sync', accountId: targetAccountId },
      });
      if (error || data?.error) {
        if (!silent) {
          setSyncMessage(data?.error || error?.message || 'MT5 sync pending...');
        }
      } else {
        if (data?.account) {
          setAccounts((prev) =>
            prev.map((acc) => (acc.id === data.account.id ? { ...acc, ...data.account } : acc))
          );
        } else if (typeof data?.balance === 'number' || typeof data?.equity === 'number') {
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === targetAccountId
                ? {
                    ...acc,
                    ...(typeof data.balance === 'number'
                      ? { balance: data.balance, initial_balance: data.balance }
                      : {}),
                    ...(typeof data.equity === 'number' ? { equity: data.equity } : {}),
                  }
                : acc
            )
          );
        } else {
          await refreshAccounts();
        }
        await refreshTrades();
        if (!silent) {
          setSyncMessage(`Synced ${data?.syncedCount ?? 0} MT5 deals`);
        }
      }
      setIsSyncingMt5(false);
    },
    [refreshAccounts, refreshTrades]
  );

  // Auto-sync whenever an MT5-linked account becomes active + poll every 60s
  useEffect(() => {
    if (!activeAccount?.auto_sync_enabled || !activeAccount?.metaapi_account_id) {
      setSyncMessage('');
      return;
    }
    triggerMt5Sync(activeAccount.id, true);
    const interval = setInterval(() => {
      triggerMt5Sync(activeAccount.id, true);
    }, 60000);
    return () => clearInterval(interval);
  }, [activeAccount, triggerMt5Sync]);

  const traderName =
    session?.user?.user_metadata?.trader_name ||
    session?.user?.email?.split('@')[0] ||
    'Trader';

  const localTimeData = useMemo(() => {
    const resolvedTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone: resolvedTimeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || '';
    const hourPart = getPart('hour');
    const minutePart = getPart('minute');
    const secondPart = getPart('second');
    const rawZoneLabel = getPart('timeZoneName').trim();
    const zoneLabel =
      rawZoneLabel && !/^GMT[+-]?\d/i.test(rawZoneLabel) && !/^UTC[+-]?\d/i.test(rawZoneLabel)
        ? rawZoneLabel
        : rawZoneLabel || resolvedTimeZone;

    const timeString = `${hourPart}:${minutePart}:${secondPart}`;

    // Global FX market hours in UTC:
    // Forex opens Sunday 22:00 UTC and closes Friday 22:00 UTC
    // Sydney: 22:00–07:00 UTC | Tokyo: 00:00–09:00 UTC | London: 08:00–17:00 UTC | New York: 13:00–22:00 UTC
    const utcDay = now.getUTCDay();
    const utcHour = now.getUTCHours();

    const isWeekendClosed =
      utcDay === 6 ||
      (utcDay === 0 && utcHour < 22) ||
      (utcDay === 5 && utcHour >= 22);

    if (isWeekendClosed) {
      return { timeString, zoneLabel, sessionName: 'Market Closed', isActive: false };
    }

    const isSydney = utcHour >= 22 || utcHour < 7;
    const isTokyo = utcHour >= 0 && utcHour < 9;
    const isLondon = utcHour >= 8 && utcHour < 17;
    const isNewYork = utcHour >= 13 && utcHour < 22;

    const activeList = [];
    if (isSydney) activeList.push('Sydney');
    if (isTokyo) activeList.push('Tokyo');
    if (isLondon) activeList.push('London');
    if (isNewYork) activeList.push('New York');

    if (activeList.length === 0) {
      return { timeString, zoneLabel, sessionName: 'Inactive', isActive: false };
    }

    return {
      timeString,
      zoneLabel,
      sessionName: activeList.join(' / '),
      isActive: true,
    };
  }, [now]);

  // --- Auth Handlers ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { trader_name: email.trim().split('@')[0] },
        },
      });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setAuthError(error.message);
    }
    setAuthSubmitting(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // --- Profile & Data Handlers ---
  const handleSaveName = async () => {
    if (tempName.trim()) {
      const { data } = await supabase.auth.updateUser({
        data: { trader_name: tempName.trim() },
      });
      if (data?.user) {
        setSession((prev) => ({ ...prev, user: data.user }));
      }
    }
    setIsEditingName(false);
  };

  const handleCloseAccountModal = () => {
    if (accountCreating || accounts.length === 0) return;
    resetAddAccountForm();
    setIsAccountModalOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount || !accountToDelete) return;
    if (!session?.user?.id) {
      setDeleteAccountError('Please sign in again before deleting this account.');
      return;
    }
    setIsDeletingAccount(true);
    setDeleteAccountError('');

    const { error: tradesDeleteError } = await supabase
      .from('trades')
      .delete()
      .eq('account_id', accountToDelete.id)
      .eq('user_id', session.user.id);

    if (tradesDeleteError) {
      setDeleteAccountError(tradesDeleteError.message);
      setIsDeletingAccount(false);
      return;
    }

    setTrades((prev) => prev.filter((trade) => trade.account_id !== accountToDelete.id));

    const { data: deletedAccount, error: accountDeleteError } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', accountToDelete.id)
      .eq('user_id', session.user.id)
      .select('id')
      .maybeSingle();

    if (accountDeleteError || !deletedAccount) {
      setDeleteAccountError(
        accountDeleteError
          ? `Trade history was deleted, but the account could not be deleted: ${accountDeleteError.message}`
          : 'Trade history was deleted, but the account could not be found or deleted.'
      );
      setIsDeletingAccount(false);
      return;
    }

    const remainingAccounts = accounts.filter((account) => account.id !== accountToDelete.id);
    setAccounts(remainingAccounts);
    if (activeAccountId === accountToDelete.id) {
      setActiveAccountId(remainingAccounts[0]?.id || '');
    }
    setShowAllTrades(false);
    setAccountToDelete(null);
    setIsDeletingAccount(false);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (accountCreating) return;
    setAccountError('');

    const cleanLogin = mt5Login.trim();
    const cleanServer = mt5Server.trim();
    if (!cleanLogin || !cleanServer || !session?.user) return;

    if (enableMt5Sync && !mt5InvestorPassword) {
      setAccountError('Enter your MT5 Investor Password for auto-sync.');
      return;
    }

    const duplicateLocal = accounts.find(
      (acc) => String(acc.mt5_login || '').trim().toLowerCase() === cleanLogin.toLowerCase()
    );
    if (duplicateLocal) {
      setAccountError(`Login ID ${cleanLogin} is already added.`);
      return;
    }

    setAccountCreating(true);

    const { data: existingAccounts, error: checkErr } = await supabase
      .from('trading_accounts')
      .select('id, mt5_login')
      .eq('user_id', session.user.id)
      .ilike('mt5_login', cleanLogin)
      .limit(1);

    if (!checkErr && existingAccounts && existingAccounts.length > 0) {
      setAccountError(`Login ID ${cleanLogin} is already added.`);
      setAccountCreating(false);
      return;
    }

    const autoName = `${cleanServer.split('-')[0]} • ${cleanLogin}`;
    const { data: createdAcc, error: insertErr } = await supabase
      .from('trading_accounts')
      .insert([
        {
          user_id: session.user.id,
          name: autoName,
          initial_balance: 0,
          balance: 0,
          equity: 0,
          mt5_login: cleanLogin,
          mt5_server: cleanServer,
          auto_sync_enabled: enableMt5Sync,
        },
      ])
      .select()
      .single();

    if (insertErr || !createdAcc) {
      const isUniqueViolation =
        insertErr?.code === '23505' ||
        String(insertErr?.message || '').toLowerCase().includes('duplicate');
      setAccountError(
        isUniqueViolation
          ? `Login ID ${cleanLogin} is already added.`
          : insertErr?.message || 'Failed to create account.'
      );
      setAccountCreating(false);
      return;
    }

    let finalAccount = createdAcc;

    if (enableMt5Sync) {
      const { data: connectData, error: connectErr } = await supabase.functions.invoke(
        'mt5-sync',
        {
          body: {
            action: 'connect',
            accountId: createdAcc.id,
            accountName: createdAcc.name,
            login: cleanLogin,
            investorPassword: mt5InvestorPassword,
            server: cleanServer,
          },
        }
      );

      if (connectErr || connectData?.error) {
        setAccountError(
          connectData?.error ||
            connectErr?.message ||
            'Account saved, but MT5 connection failed.'
        );
        setAccounts((prev) => [...prev, createdAcc]);
        setActiveAccountId(createdAcc.id);
        setMt5InvestorPassword('');
        setAccountCreating(false);
        return;
      }

      finalAccount = {
        ...createdAcc,
        ...(connectData?.account || {}),
        mt5_login: cleanLogin,
        mt5_server: cleanServer,
        metaapi_account_id: connectData.metaapiAccountId ?? createdAcc.metaapi_account_id,
        auto_sync_enabled: true,
      };
    }

    setAccounts((prev) => [...prev, finalAccount]);
    setActiveAccountId(finalAccount.id);
    setAccountCreating(false);
    resetAddAccountForm();
    setIsAccountModalOpen(false);
  };

  // --- Active Account & Metrics Calculations ---
  const accountTrades = useMemo(() => {
    if (!activeAccount) return [];
    return trades
      .filter((t) => t.account_id === activeAccount.id)
      .sort(
        (a, b) =>
          new Date(b.created_at || b.date) - new Date(a.created_at || a.date) ||
          new Date(b.date) - new Date(a.date)
      );
  }, [trades, activeAccount]);

  const visibleTrades = showAllTrades ? accountTrades : accountTrades.slice(0, 5);

  const metrics = useMemo(() => {
    const netPnl = accountTrades.reduce((sum, t) => sum + Number(t.pnl), 0);
    const hasLiveEquity =
      activeAccount &&
      activeAccount.equity !== undefined &&
      activeAccount.equity !== null &&
      Number(activeAccount.equity) !== 0;
    const hasLiveBalance =
      activeAccount &&
      activeAccount.balance !== undefined &&
      activeAccount.balance !== null &&
      Number(activeAccount.balance) !== 0;
    const initial = activeAccount ? Number(activeAccount.initial_balance || 0) : 0;
    const equity = hasLiveEquity
      ? Number(activeAccount.equity)
      : hasLiveBalance
      ? Number(activeAccount.balance)
      : initial + netPnl;
    const totalTrades = accountTrades.length;
    const winningTrades = accountTrades.filter((t) => Number(t.pnl) > 0).length;
    const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;

    const dailyMap = {};
    const dailyTradeCounts = {};
    accountTrades.forEach((t) => {
      dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.pnl);
      dailyTradeCounts[t.date] = (dailyTradeCounts[t.date] || 0) + 1;
    });

    const dailyTotals = Object.values(dailyMap);
    const bestDay = dailyTotals.length > 0 ? Math.max(0, ...dailyTotals) : 0;
    const consistencyTarget = bestDay > 0 ? bestDay / 0.15 : 0;
    const isConsistencyMet = bestDay > 0 && netPnl >= consistencyTarget;

    let mostTraded = '—';
    if (accountTrades.length > 0) {
      const freq = {};
      let maxCount = 0;
      accountTrades.forEach((t) => {
        const sym = t.asset.toUpperCase();
        freq[sym] = (freq[sym] || 0) + 1;
        if (freq[sym] > maxCount) {
          maxCount = freq[sym];
          mostTraded = sym;
        }
      });
    }

    return {
      equity,
      netPnl,
      winRate,
      bestDay,
      consistencyTarget,
      isConsistencyMet,
      mostTraded,
      dailyMap,
      dailyTradeCounts,
    };
  }, [activeAccount, accountTrades]);

  // --- Calendar Grid Grouped by Weeks (Sun-Sat + Weekly PnL Column) ---
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString(undefined, { month: 'long' });
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const flatCells = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      flatCells.push({ type: 'empty', key: `empty-start-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(
        2,
        '0'
      )}`;
      const dayPnl = metrics.dailyMap[dateStr];
      const tradeCount = metrics.dailyTradeCounts[dateStr] || 0;
      flatCells.push({
        type: 'day',
        key: dateStr,
        day,
        dateStr,
        pnl: dayPnl,
        tradeCount,
      });
    }
    while (flatCells.length % 7 !== 0) {
      flatCells.push({ type: 'empty', key: `empty-end-${flatCells.length}` });
    }

    const weeks = [];
    for (let i = 0; i < flatCells.length; i += 7) {
      const days = flatCells.slice(i, i + 7);
      let weekTotal = 0;
      let hasTrades = false;
      days.forEach((cell) => {
        if (cell.type === 'day' && cell.pnl !== undefined) {
          weekTotal += Number(cell.pnl);
          hasTrades = true;
        }
      });
      weeks.push({
        weekIndex: weeks.length + 1,
        days,
        weekTotal,
        hasTrades,
      });
    }

    return { year, monthName, weeks };
  }, [currentDate, metrics.dailyMap, metrics.dailyTradeCounts]);

  const changeMonth = (offset) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const formatCurrency = (val) => {
    const abs = Math.abs(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return val < 0 ? `-$${abs}` : `$${abs}`;
  };

  const formatCompactPnl = (val) => {
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    const abs = Math.abs(val);
    return `${sign}$${abs % 1 === 0 ? abs.toLocaleString() : abs.toFixed(2)}`;
  };

  const formatPrice = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  };

  const selectorAccountName = activeAccount
    ? (activeAccount.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ')
    : dataLoading
    ? 'Syncing...'
    : 'No Account';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
        Loading Elite Trading Journal...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 justify-center flex-wrap">
              <span className="px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded">
                PRO
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-white">Elite Trading Journal</h1>
            </div>
            <p className="text-xs text-zinc-400">
              {isSignUp
                ? 'Create a profile to sync your accounts across all devices'
                : 'Sign in to access your synced trading accounts'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="trader@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter password (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
            >
              {authSubmitting ? 'Please wait...' : isSignUp ? 'Create Profile' : 'Sign In'}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
              }}
              className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              {isSignUp
                ? 'Already have a profile? Sign In'
                : "Don't have a profile? Create one"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-5 lg:px-8 lg:py-6">
      <div className="w-full max-w-none xl:max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
        {/* HEADER */}
        <header className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
            <div className="flex items-center gap-2.5 justify-self-start min-w-0">
              <span className="px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded shrink-0">
                PRO
              </span>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-white truncate">
                Elite Trading Journal
              </h1>
            </div>

            {/* Centered Top VOTD Dynamic Island Pill & Pop-out Card */}
            <div ref={votdIslandRef} className="relative justify-self-center self-center">
              <button
                type="button"
                onClick={handleToggleVotdIsland}
                aria-expanded={isVotdExpanded}
                title="Verse of the Day for Traders"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 transition-all duration-300 hover:bg-emerald-500/15 ${
                  !hasSeenVotdToday && !isVotdExpanded
                    ? 'animate-pulse ring-2 ring-emerald-400/35 shadow-[0_0_16px_rgba(52,211,153,0.22)]'
                    : ''
                } ${isVotdExpanded ? 'rounded-2xl px-3.5 bg-zinc-900 border-emerald-400/40' : ''}`}
              >
                <span
                  className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 ${
                    !hasSeenVotdToday ? 'animate-ping' : ''
                  }`}
                />
                <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span className="font-semibold tracking-wide text-emerald-200">VOTD</span>
                <span className="hidden md:inline text-[11px] font-mono text-emerald-300/80">
                  {verseOfTheDay.reference}
                </span>
              </button>

              {isVotdExpanded && (
                <div
                  role="dialog"
                  aria-label="Verse of the Day"
                  className="absolute left-1/2 -translate-x-1/2 z-40 mt-2 w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-emerald-400/30 bg-zinc-950/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur-2xl transition-all duration-300"
                >
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {verseOfTheDay.reference}
                        </div>
                        <div className="text-[10px] font-medium text-emerald-300/90 truncate">
                          {verseOfTheDay.theme} • {todayLocalStr}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsVotdExpanded(false)}
                      aria-label="Collapse Verse of the Day"
                      className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2.5 text-xs leading-relaxed">
                    <p className="text-zinc-200">
                      {verseOfTheDay.paraphrase}
                    </p>
                    <div className="rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-200/95">
                      <span className="font-semibold text-emerald-300">Trading Edge: </span>
                      {verseOfTheDay.tradingApplication}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 justify-self-end">
              <div className="font-mono text-xs sm:text-sm lg:text-base font-semibold text-zinc-200 bg-zinc-900/90 border border-zinc-800 px-3 py-1 rounded-lg whitespace-nowrap">
                {localTimeData.timeString}{' '}
                <span className="text-xs text-zinc-500">{localTimeData.zoneLabel}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 text-emerald-400 hover:bg-zinc-800 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="text-sm font-medium text-zinc-300">{traderName}</span>
                  <button
                    onClick={() => {
                      setTempName(traderName);
                      setIsEditingName(true);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Edit Trader Name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs lg:text-sm font-medium text-zinc-300">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  localTimeData.isActive
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                    : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
                }`}
              />
              <span>{localTimeData.sessionName}</span>
            </div>
          </div>

          <div className="border-b border-zinc-800/80 pt-1" />
        </header>

        {/* STYLED ACCOUNT SELECTOR & MT5 SYNC BAR */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            {activeAccount?.auto_sync_enabled && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <button
                  onClick={() => triggerMt5Sync(activeAccount.id, false)}
                  disabled={isSyncingMt5}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-semibold transition-colors disabled:opacity-50"
                  title="Sync closed MT5 trades now"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingMt5 ? 'animate-spin' : ''}`} />
                  <span>{isSyncingMt5 ? 'Syncing' : 'Sync Now'}</span>
                </button>
              </div>
            )}
            {syncMessage && <span className="text-xs text-zinc-400">{syncMessage}</span>}
          </div>

          {/* Custom account switcher and add-account control */}
          <div className="relative self-start sm:self-auto sm:ml-auto" ref={accountDropdownRef}>
            <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5">
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen((open) => !open)}
                disabled={accounts.length === 0 || dataLoading}
                aria-haspopup="menu"
                aria-expanded={isAccountDropdownOpen}
                className="group inline-grid h-7 w-fit min-w-[80px] max-w-[190px] grid-cols-[12px_auto_20px] items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-center transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="col-start-2 block max-w-[150px] truncate whitespace-nowrap text-[11px] font-medium text-zinc-100">
                  {selectorAccountName}
                </span>
                <ChevronDown
                  className={`col-start-3 h-3.5 w-3.5 justify-self-end text-zinc-300 transition-transform ${
                    isAccountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={openAddAccountModal}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-zinc-950"
                title="Add New Account"
                aria-label="Add new account"
              >
                <Plus className="h-3 w-3 stroke-[2.75]" />
              </button>
            </div>

            {isAccountDropdownOpen && accounts.length > 0 && (
              <div className="absolute left-0 sm:left-auto sm:right-0 z-40 mt-1.5 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5 backdrop-blur-xl">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Accounts
                  </p>
                  <span className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-zinc-400">
                    {accounts.length}
                  </span>
                </div>
                <div
                  role="menu"
                  aria-label="Trading accounts"
                  className="max-h-64 space-y-0.5 overflow-y-auto"
                >
                  {accounts.map((acc) => {
                    const isActive = acc.id === activeAccountId;
                    return (
                      <div
                        key={acc.id}
                        role="group"
                        className={`flex w-full items-center gap-1 rounded-lg border p-1 transition-colors ${
                          isActive
                            ? 'border-emerald-400/30 bg-emerald-500/[0.09]'
                            : 'border-zinc-700 bg-transparent hover:border-zinc-500'
                        }`}
                      >
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={isActive}
                          onClick={() => {
                            setActiveAccountId(acc.id);
                            setIsAccountDropdownOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-100">
                            {acc.name}
                          </span>
                          {acc.auto_sync_enabled && (
                            <span className="shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-1 py-0.5 text-[8px] font-semibold text-emerald-300">
                              MT5
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountDropdownOpen(false);
                            setAccountToDelete(acc);
                            setDeleteAccountError('');
                          }}
                          title={`Delete ${acc.name}`}
                          aria-label={`Delete ${acc.name}`}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RESPONSIVE METRICS GRID: 1 col mobile, 2 cols tablet, 3 cols laptop/desktop */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Equity</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1 tabular-nums">
                {formatCurrency(metrics.equity)}
              </p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Net PnL</p>
              <p
                className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-1 tabular-nums ${
                  metrics.netPnl > 0
                    ? 'text-emerald-400'
                    : metrics.netPnl < 0
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                {metrics.netPnl > 0
                  ? `+${formatCurrency(metrics.netPnl)}`
                  : formatCurrency(metrics.netPnl)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.netPnl >= 0
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {metrics.netPnl >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Win Rate</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1 tabular-nums">
                {metrics.winRate}%
              </p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Best Day</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-400 mt-1 tabular-nums">
                {formatCurrency(metrics.bestDay)}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
          </div>

          <div
            className={`bg-zinc-900/80 border rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center justify-between transition-all ${
              metrics.isConsistencyMet
                ? 'border-emerald-500/70 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                : 'border-rose-500/70 shadow-[0_0_16px_rgba(244,63,94,0.22)]'
            }`}
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                15% Consistency Score
              </p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1 tabular-nums">
                {formatCurrency(metrics.consistencyTarget)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                metrics.isConsistencyMet
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              <Target className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 lg:p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Most Traded
              </p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1">
                {metrics.mostTraded}
              </p>
            </div>
            <div className="p-3 bg-zinc-800/70 rounded-xl text-zinc-300 font-mono text-xs font-bold">
              TOP
            </div>
          </div>
        </section>

        {/* AUTOMATED TRADE LOG: CARDS ON MOBILE, TABLE ON TABLET/LAPTOP */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-zinc-800">
            <h2 className="text-base lg:text-lg font-semibold text-white">Trade Log</h2>
          </div>

          <div className="divide-y divide-zinc-800/70 md:hidden">
            {accountTrades.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-zinc-500">
                {dataLoading
                  ? 'Loading synced trades...'
                  : 'No trades synced for this account yet.'}
              </div>
            ) : (
              visibleTrades.map((trade) => {
                const isProfit = Number(trade.pnl) >= 0;
                return (
                  <div key={trade.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-white truncate">
                          {trade.asset}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                            trade.direction === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {trade.direction}
                        </span>
                        {trade.mt5_deal_id && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            MT5
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit
                          ? `+${formatCurrency(Number(trade.pnl))}`
                          : formatCurrency(Number(trade.pnl))}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 font-mono">
                      <div>
                        Date: <span className="text-zinc-300">{trade.date}</span>
                      </div>
                      <div>
                        Lots: <span className="text-zinc-300 tabular-nums">{trade.lots}</span>
                      </div>
                      <div>
                        ENP:{' '}
                        <span className="text-zinc-300 tabular-nums">{formatPrice(trade.enp)}</span>
                      </div>
                      <div>
                        EXP:{' '}
                        <span className="text-zinc-300 tabular-nums">{formatPrice(trade.exp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 text-xs uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                  <th className="py-3 px-4 lg:px-6">Date</th>
                  <th className="py-3 px-4 lg:px-6">Asset</th>
                  <th className="py-3 px-4 lg:px-6">Direction</th>
                  <th className="py-3 px-4 lg:px-6">Lots</th>
                  <th className="py-3 px-4 lg:px-6 text-right">ENP</th>
                  <th className="py-3 px-4 lg:px-6 text-right">EXP</th>
                  <th className="py-3 px-4 lg:px-6 text-right">PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {accountTrades.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-zinc-500">
                      {dataLoading
                        ? 'Loading synced trades...'
                        : 'No trades synced for this account yet.'}
                    </td>
                  </tr>
                ) : (
                  visibleTrades.map((trade) => {
                    const isProfit = Number(trade.pnl) >= 0;
                    return (
                      <tr key={trade.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 lg:px-6 font-mono text-xs text-zinc-300 whitespace-nowrap">
                          {trade.date}
                        </td>
                        <td className="py-3 px-4 lg:px-6 font-semibold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{trade.asset}</span>
                            {trade.mt5_deal_id && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                MT5
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 lg:px-6 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold rounded ${
                              trade.direction === 'BUY'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-3 px-4 lg:px-6 font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                          {trade.lots}
                        </td>
                        <td className="py-3 px-4 lg:px-6 text-right font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                          {formatPrice(trade.enp)}
                        </td>
                        <td className="py-3 px-4 lg:px-6 text-right font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                          {formatPrice(trade.exp)}
                        </td>
                        <td
                          className={`py-3 px-4 lg:px-6 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit
                            ? `+${formatCurrency(Number(trade.pnl))}`
                            : formatCurrency(Number(trade.pnl))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {accountTrades.length > 5 && (
            <div className="flex justify-center border-t border-zinc-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowAllTrades((showingAll) => !showingAll)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-zinc-800/70 hover:text-zinc-100"
              >
                {showAllTrades ? 'Show less' : 'Show more'}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showAllTrades ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          )}
        </section>

        {/* MONTHLY CALENDAR WITH WEEKLY PNL COLUMN AFTER SATURDAY */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 lg:p-6 space-y-4">
          <div className="flex flex-col items-center justify-center space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-zinc-400">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>{calendarData.year}</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white min-w-[120px] sm:min-w-[140px] text-center">
                {calendarData.monthName}
              </h2>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[540px] sm:min-w-[680px] lg:min-w-full space-y-1.5 lg:space-y-2">
              <div className="grid grid-cols-8 gap-1 sm:gap-1.5 lg:gap-2 text-center text-[11px] sm:text-xs font-semibold text-zinc-500 pt-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
                <div className="py-1 text-zinc-400">Week PnL</div>
              </div>

              {calendarData.weeks.map((week) => {
                const weekIsPos = week.hasTrades && week.weekTotal > 0;
                const weekIsNeg = week.hasTrades && week.weekTotal < 0;
                return (
                  <div
                    key={`week-${week.weekIndex}`}
                    className="grid grid-cols-8 gap-1 sm:gap-1.5 lg:gap-2"
                  >
                    {week.days.map((cell) => {
                      if (cell.type === 'empty') {
                        return (
                          <div
                            key={cell.key}
                            className="h-14 sm:h-16 md:h-20 lg:h-24 rounded-xl bg-zinc-950/30 border border-zinc-900/50"
                          />
                        );
                      }
                      const hasPnl = cell.pnl !== undefined;
                      const isPos = hasPnl && cell.pnl > 0;
                      const isNeg = hasPnl && cell.pnl < 0;
                      const isToday = cell.dateStr === todayLocalStr;
                      return (
                        <div
                          key={cell.key}
                          className={`h-14 sm:h-16 md:h-20 lg:h-24 rounded-xl border p-1.5 sm:p-2 lg:p-2.5 flex flex-col justify-between transition-all ${
                            isPos
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : isNeg
                              ? 'bg-rose-500/10 border-rose-500/30'
                              : 'bg-zinc-950/70 border-zinc-800/80'
                          } ${
                            isToday
                              ? '!border-emerald-500/35 shadow-[0_0_8px_rgba(52,211,153,0.12)] ring-1 ring-emerald-500/15'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[11px] sm:text-xs font-medium ${
                                isToday ? 'text-emerald-400/80 font-semibold' : 'text-zinc-400'
                              }`}
                            >
                              {cell.day}
                            </span>
                            {cell.tradeCount > 0 && (
                              <span className="inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-emerald-500/15 px-1 text-[9px] font-semibold tabular-nums text-emerald-300">
                                {cell.tradeCount}
                              </span>
                            )}
                          </div>
                          {hasPnl && (
                            <span
                              className={`text-[11px] sm:text-xs md:text-sm font-mono font-bold truncate tabular-nums ${
                                isPos
                                  ? 'text-emerald-400'
                                  : isNeg
                                  ? 'text-rose-400'
                                  : 'text-zinc-300'
                              }`}
                            >
                              {formatCompactPnl(cell.pnl)}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    <div
                      className={`h-14 sm:h-16 md:h-20 lg:h-24 rounded-xl border p-1.5 sm:p-2 lg:p-2.5 flex flex-col justify-between transition-colors ${
                        weekIsPos
                          ? 'bg-emerald-500/15 border-emerald-500/40'
                          : weekIsNeg
                          ? 'bg-rose-500/15 border-rose-500/40'
                          : 'bg-zinc-950/90 border-zinc-800/90'
                      }`}
                    >
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        W{week.weekIndex}
                      </span>
                      <span
                        className={`text-[11px] sm:text-xs md:text-sm font-mono font-bold truncate tabular-nums ${
                          weekIsPos
                            ? 'text-emerald-400'
                            : weekIsNeg
                            ? 'text-rose-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {week.hasTrades ? formatCompactPnl(week.weekTotal) : '$0'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ADD ACCOUNT MODAL */}
      {isAccountModalOpen && (
        <div
          onClick={handleCloseAccountModal}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 py-8 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-5 shadow-2xl overflow-visible transition-all duration-200 ${
              isServerDropdownExpanded ? 'pb-7' : 'pb-5 sm:pb-6'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Trading Account</h3>
              {accounts.length > 0 && (
                <button
                  type="button"
                  onClick={handleCloseAccountModal}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form
              key={accountModalSessionKey}
              onSubmit={handleCreateAccount}
              autoComplete="off"
              className="space-y-4 overflow-visible"
            >
              <div className="space-y-3 overflow-visible">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      Connect MT5 Auto-Sync
                    </span>
                    <span className="text-xs text-zinc-400">
                      Balance, equity & closed trades sync automatically
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableMt5Sync}
                    onChange={(e) => setEnableMt5Sync(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded shrink-0"
                  />
                </label>

                <div className="space-y-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 overflow-visible transition-all duration-200">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      MT5 Login ID
                    </label>
                    <input
                      type="text"
                      name={`mt5_login_${accountModalSessionKey}`}
                      autoComplete="off"
                      required
                      placeholder="e.g. 51294810"
                      value={mt5Login}
                      onChange={(e) => setMt5Login(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {enableMt5Sync && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Investor Password (Read-Only)
                      </label>
                      <input
                        type="password"
                        name={`mt5_investor_password_${accountModalSessionKey}`}
                        autoComplete="new-password"
                        required={enableMt5Sync}
                        placeholder="Enter read-only investor password"
                        value={mt5InvestorPassword}
                        onChange={(e) => setMt5InvestorPassword(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <BrokerServerDropdown
                    required
                    value={mt5Server}
                    onChange={setMt5Server}
                    onDropdownStateChange={setIsServerDropdownExpanded}
                  />

                  <div className="flex items-start gap-2 text-[11px] text-zinc-400 pt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Your balance and equity populate automatically once connected. Investor password grants read-only access only.
                    </span>
                  </div>
                </div>
              </div>

              {accountError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {accountError}
                </p>
              )}

              <button
                type="submit"
                disabled={accountCreating}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
              >
                {accountCreating
                  ? 'Connecting to MT5...'
                  : enableMt5Sync
                  ? 'Connect & Save Account'
                  : 'Save Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {accountToDelete && (
        <div
          onClick={() => {
            if (!isDeletingAccount) {
              setAccountToDelete(null);
              setDeleteAccountError('');
            }
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.65)] ring-1 ring-white/5 backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <h3 id="delete-account-title" className="text-sm font-bold text-white">
              Delete account?
            </h3>
            <p className="mt-2 text-sm text-zinc-300">
              Delete &apos;{accountToDelete.name}&apos;?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              This will permanently delete the account and all of its trade history.
            </p>
            {deleteAccountError && (
              <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {deleteAccountError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAccountToDelete(null);
                  setDeleteAccountError('');
                }}
                disabled={isDeletingAccount}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingAccount ? 'Deleting...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}