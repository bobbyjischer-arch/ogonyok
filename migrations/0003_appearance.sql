-- Оформление хранится на сервере, а не только в localStorage: тема, выбранная
-- на телефоне, должна подхватиться и в десктопном Telegram.

-- 'auto' — как в клиенте Telegram, иначе 'light' | 'dark'.
ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'auto';

-- 'system' | 'warm' | 'telegram' (палитра из темы самого клиента).
ALTER TABLE users ADD COLUMN palette TEXT NOT NULL DEFAULT 'system';
