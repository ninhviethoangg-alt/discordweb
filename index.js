const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({ origin: '*' }));

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

// 1. Khi bot khởi động: Quét toàn bộ thành viên hiện có
client.on(Events.ClientReady, async (c) => {
    console.log(`🤖 Bot đã đăng nhập: ${c.user.tag}`);
    const guild = client.guilds.cache.get(SERVER_ID);
    if (guild) {
        await guild.members.fetch({ force: true });
        for (const [id, m] of guild.members.cache) {
            if (!m.user.bot) {
                await Member.findOneAndUpdate({ name: m.user.username }, { name: m.user.username, joinedAt: m.joinedAt }, { upsert: true });
            }
        }
        console.log("✅ Đã đồng bộ xong danh sách thành viên!");
    }
});

// 2. MỚI: Sự kiện tự động lưu khi có người mới vào
client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.user.bot) {
        console.log(`🚀 Thành viên mới: ${member.user.username}`);
        await Member.findOneAndUpdate(
            { name: member.user.username }, 
            { name: member.user.username, joinedAt: member.joinedAt }, 
            { upsert: true }
        );
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