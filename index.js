const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({ origin: '*' }));

// Lấy thông tin bảo mật từ Render Environment Variables
const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const SERVER_ID = "1314192364939640842";

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Đã kết nối MongoDB!'))
    .catch(err => console.error('❌ Lỗi MongoDB:', err));

const memberSchema = new mongoose.Schema({ name: String, joinedAt: Date });
const Member = mongoose.model('Member', memberSchema);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences] 
});

client.on(Events.ClientReady, async (c) => {
    console.log(`🤖 Bot đã đăng nhập: ${c.user.tag}`);
    const guild = client.guilds.cache.get(SERVER_ID);
    if (guild) {
        const members = await guild.members.fetch({ force: true });
        for (const [id, m] of members) {
            if (!m.user.bot) {
                await Member.findOneAndUpdate({ name: m.user.username }, { name: m.user.username, joinedAt: m.joinedAt }, { upsert: true });
            }
        }
    }
});

app.get('/api/members', async (req, res) => {
    try {
        const members = await Member.find().sort({ joinedAt: 1 });
        res.send(members.map(m => `${m.name}|${m.joinedAt.toISOString()}`).join('\n'));
    } catch (err) { res.status(500).send("Lỗi"); }
});

app.get('/api/stats', (req, res) => {
    const guild = client.guilds.cache.get(SERVER_ID);
    if (!guild) return res.json({ total: 0, online: 0, boostLevel: 0 });

    // Đếm online dựa trên trạng thái của member
    const onlineCount = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
    
    res.json({ 
        total: guild.memberCount, 
        online: onlineCount,
        boostLevel: guild.premiumSubscriptionCount || 0
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 API đang mở tại cổng ${PORT}`));
client.login(TOKEN);