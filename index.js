const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// 1. CẤU HÌNH CƠ BẢN
const TOKEN = 'YOUR_BOT_TOKEN_HERE'; // Dán token của ông vào đây
const SERVER_ID = "1514089514535096482";

// Link kho chứa Database (Tôi đã sửa mã hóa dấu @ thành %40 và thêm tên DB là ghostDB)
const MONGO_URI = "mongodb+srv://ninhviethoangg_db_user:0909782489Aa%40@cluster0.fctypqy.mongodb.net/ghostDB?retryWrites=true&w=majority&appName=Cluster0";

const app = express();
app.use(cors());

// 2. KẾT NỐI MẠNG LƯỚI ĐÁM MÂY (MONGODB)
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Đã kết nối thành công với kho lưu trữ MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Tạo khuôn mẫu lưu dữ liệu vào kho
const memberSchema = new mongoose.Schema({
    name: String,
    joinedAt: Date
});
const Member = mongoose.model('Member', memberSchema);

// 3. CẤU HÌNH DISCORD BOT
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences 
    ] 
});

client.on(Events.ClientReady, async (c) => {
    console.log(`🤖 Bot đã đăng nhập: ${c.user.tag}`);
    const guild = client.guilds.cache.get(SERVER_ID);
    
    if (guild) {
        try {
            // Quét toàn bộ thành viên hiện tại
            const members = await guild.members.fetch({ force: true });
            
            // Đồng bộ lên Đám mây (Sử dụng thời gian gia nhập GỐC từ Discord để chuẩn từng giây)
            for (const [id, m] of members) {
                if (!m.user.bot) {
                    await Member.findOneAndUpdate(
                        { name: m.user.username }, 
                        { name: m.user.username, joinedAt: m.joinedAt }, // Lấy giờ chuẩn từ Discord
                        { upsert: true, new: true }
                    );
                }
            }
            console.log(`☁️ Đã đồng bộ ${members.size} thành viên lên hệ thống Đám mây.`);
        } catch (err) {
            console.error("❌ Lỗi khi quét:", err);
        }
    }
});

// Sự kiện Rình người mới tham gia (Real-time)
client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.user.bot) {
        try {
            await Member.create({
                name: member.user.username,
                joinedAt: new Date()
            });
            console.log(`👤 Đã lưu tân binh vào kho: ${member.user.username}`);
        } catch (err) {
            console.error("❌ Lỗi lưu người mới:", err);
        }
    }
});

// 4. API CHO TRANG WEB TRUY CẬP LẤY SỐ LIỆU
// Cổng lấy danh sách thành viên (Đã tự động lấy chính xác Giờ/Phút/Giây)
app.get('/api/members', async (req, res) => {
    try {
        const members = await Member.find().sort({ joinedAt: 1 });
        // Biến Date thành dạng ISO để web html nhận diện chuẩn xác
        const memberList = members.map(m => `${m.name}|${m.joinedAt.toISOString()}`).join('\n');
        res.send(memberList);
    } catch (err) {
        res.status(500).send("");
    }
});

// Cổng thống kê (Tổng, Online, Boost)
app.get('/api/stats', (req, res) => {
    const guild = client.guilds.cache.get(SERVER_ID);
    if (guild) {
        const total = guild.memberCount;
        const online = guild.presences.cache.filter(p => p.status !== 'offline').size;
        const boostLevel = guild.premiumTier; 
        res.json({ total: total, online: online, boostLevel: boostLevel });
    } else {
        res.json({ total: 0, online: 0, boostLevel: 0 });
    }
});

// 5. KHỞI ĐỘNG HỆ THỐNG
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Cổng API đang mở tại http://localhost:${PORT}`);
});

client.login(TOKEN);