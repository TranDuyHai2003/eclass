-- Nguồn sổ xu mới: RESET (thầy cho reset xu toàn bộ học sinh 26/11/2026). Tách migration riêng vì giá trị enum mới
-- không dùng được trong cùng giao dịch vừa thêm nó.
ALTER TYPE "PointSource" ADD VALUE IF NOT EXISTS 'RESET';
