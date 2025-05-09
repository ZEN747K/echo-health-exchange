FROM node:alpine

# กำหนด Working Directory ภายใน Container
WORKDIR /app

# ติดตั้งแพ็กเกจ 'serve' แบบ global
# 'serve' เป็น HTTP server ง่ายๆ สำหรับให้บริการไฟล์ static
RUN npm install -g serve

# คัดลอกไฟล์ static ของคุณไปยัง Working Directory
COPY index.html styles.css script.js ./

EXPOSE 80


# คำสั่งสำหรับรัน 'serve' เพื่อให้บริการไฟล์จาก Directory ปัจจุบัน (/app) บน port 80
# '.' หมายถึงให้บริการไฟล์จาก Directory ปัจจุบัน
# '-l 80' หมายถึงให้ listen บน port 80
CMD ["serve", "-l", "80", "."]
