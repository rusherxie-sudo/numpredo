-- 独立新表；不接触静态题库和旧数据库表。
CREATE TABLE public_puzzles (
 id TEXT PRIMARY KEY, grid TEXT NOT NULL UNIQUE CHECK(length(grid)=81),
 validation TEXT NOT NULL CHECK(validation IN ('unique','pending_validation')),
 validation_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','public','hidden')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX public_puzzles_listing ON public_puzzles(status,created_at DESC,id DESC);
CREATE TABLE public_puzzle_submissions (
 id TEXT PRIMARY KEY, puzzle_id TEXT NOT NULL REFERENCES public_puzzles(id),
 input_method TEXT NOT NULL, notice_version TEXT NOT NULL, confirmed_at TEXT NOT NULL,
 withdraw_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','withdrawn')),
 source_json TEXT, source_status TEXT NOT NULL DEFAULT 'unverified' CHECK(source_status IN ('unverified','verified','disputed')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX public_submissions_puzzle ON public_puzzle_submissions(puzzle_id,status);
-- 分钟窗口内的加盐哈希IP键；不保存原始IP，写入时清理旧窗口。
CREATE TABLE public_puzzle_rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE INDEX public_puzzle_rate_window ON public_puzzle_rate_limits(window);
CREATE TABLE public_puzzle_audit (
 id TEXT PRIMARY KEY, puzzle_id TEXT NOT NULL REFERENCES public_puzzles(id), submission_id TEXT,
 action TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
);
