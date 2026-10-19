-- ============================================================================
--  UniArchive — Seed Data (DML)
--  Run AFTER schema.sql:   mariadb test_uniarchive < db/seed.sql
--  ---------------------------------------------------------------------------
--  Real course material (VIT Fall 2026-27): SQL lab manual, DBMS indexing
--  problems, Probability & Statistics tutorials/solutions, a Computer Networks
--  lab report and a course syllabus.  Files are hosted on Cloudinary; every row
--  here can be previewed and downloaded from the app.
--
--  Demo logins:
--    admin123        / scse        (admin, legacy SHA-256 hash)
--    everything else / student123 (students, salted scrypt hashes)
--  ============================================================================

USE `test_uniarchive`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `course_activity`;
TRUNCATE TABLE `course_topic_coverage`;
TRUNCATE TABLE `course_stats`;
TRUNCATE TABLE `comments`;
TRUNCATE TABLE `resource_topics`;
TRUNCATE TABLE `resources`;
TRUNCATE TABLE `otp_requests`;
TRUNCATE TABLE `professors`;
TRUNCATE TABLE `semesters`;
TRUNCATE TABLE `topics`;
TRUNCATE TABLE `resource_types`;
TRUNCATE TABLE `slots`;
TRUNCATE TABLE `courses`;
TRUNCATE TABLE `users`;

-- Keep FK checks off while loading seed data in dependency order (users ->
-- courses/slots/types/professors/semesters/topics -> resources -> comments ->
-- course_stats -> course_topic_coverage -> course_activity).  Turning checks
-- back on between the TRUNCATEs and the INSERTs made the batch fail at the
-- resources INSERT with fk_resources_author even though users(user_id=1)
-- existed; leaving checks off avoids that.

-- ---------------------------------------------------------------------------
-- users
--   user 1 is the demo admin (password: scse, legacy unsalted SHA-256).
--   Every other account is a student with the shared demo password
--   `student123`, stored as a salted scrypt hash (see authRepository.ts).
-- ---------------------------------------------------------------------------
INSERT INTO `users` (user_id, username, email, password_hash, role, is_verified) VALUES
    (1, 'admin123', 'admin123@uniarchive.local',
        'bea9ee0a528a05f2dbf92324ac6547b4f630ce51aad42e6e6404472886c21a79', 'admin', 1),
    (2, 'pratikambastha5', 'pratikambastha5@vitstudent.ac.in',
        'scrypt$931674d23a244109ecb5c1a48b231f61$060b723140a92251941a73127811633929e0884659abca8f6449d4ac29c5d665', 'student', 1),
    (3, 'aarav.sharma', 'aarav.sharma@vitstudent.ac.in',
        'scrypt$1b50ca8e9b0a40b3bd595b3b146867b5$5361c60ded08d98479646245423713e35f4ab983a90df071c324e227c08fe4bd', 'student', 1),
    (4, 'meera.iyer', 'meera.iyer@vitstudent.ac.in',
        'scrypt$894d8c74899c632a6b4545816595e508$e8edc7d74df82ce2cec519fec11913d8b7c71447f06227869459e8dc7f93445c', 'student', 1),
    (5, 'rohan.gupta', 'rohan.gupta@vitstudent.ac.in',
        'scrypt$7ac807cf8de6ec10e84ecf1acb148719$fddfafb57a53248bf3644ff02b2c51786614a8dc425cc93730bfd76eefb35f3f', 'student', 1),
    (6, 'ananya.rao', 'ananya.rao@vitstudent.ac.in',
        'scrypt$26f59b605ffc3acd10d3728291a75eab$8f2da998228ed99686e8af7df2c327770503c67b4aa4e07d21d18421840d7251', 'student', 1),
    (7, 'kabir.menon', 'kabir.menon@vitstudent.ac.in',
        'scrypt$d6e0a0fb3f4d4b81511de89290649b14$7600e72a61fc91fecbef8b952a9c0a76b2d7a8b72ad46d6b06810fed7f141f1c', 'student', 1);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
INSERT INTO `courses` (course_id, course_code, course_name) VALUES
    (1, 'BACSE202', 'Database Systems'),
    (2, 'BAMAT207', 'Probability and Statistics'),
    (3, 'BACSE203', 'Computer Networks'),
    (4, 'BASTS101', 'Qualitative and Quantitative Skills Practice I');

-- ---------------------------------------------------------------------------
-- slots
-- ---------------------------------------------------------------------------
INSERT INTO `slots` (slot_id, slot_code) VALUES
    (1,'B1'),(2,'G2'),(3,'C1'),(4,'D1'),(5,'A1');

-- ---------------------------------------------------------------------------
-- resource_types
-- ---------------------------------------------------------------------------
INSERT INTO `resource_types` (type_id, type_name) VALUES
    (1,'Notes'),(2,'Question Bank'),(3,'Cheatsheet'),(4,'Lab Report'),(5,'Solution');

-- ---------------------------------------------------------------------------
-- professors
-- ---------------------------------------------------------------------------
INSERT INTO `professors` (professor_id, professor_name) VALUES
    (1,'Prof. Chandran'),(2,'Prof. Sharma'),(3,'Dr. Srinivasan'),(4,'Prof. Meera');

-- ---------------------------------------------------------------------------
-- semesters
-- ---------------------------------------------------------------------------
INSERT INTO `semesters` (semester_id, semester_name, year) VALUES
    (1,'Fall','2026'),
    (2,'Winter','2026');

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
INSERT INTO `topics` (topic_id, topic_name) VALUES
    -- Probability & Statistics
    (1,'Probability'),(2,'Random Variables'),(3,'Combinatorics'),
    (4,'Normal Distribution'),(5,'Hypothesis Testing'),(6,'ANOVA'),
    (7,'Regression'),(8,'Statistics'),
    -- Databases
    (9,'SQL'),(10,'Joins'),(11,'Functions'),(12,'Indexing'),
    (13,'PL/SQL'),(14,'DBMS'),(15,'Relational Model'),(16,'Normalization'),
    -- Networks
    (17,'Networks'),(18,'Topology'),(19,'Routing'),
    -- Skills / syllabus
    (20,'Quantitative Skills'),(21,'Syllabus'),
    -- coverage-only topics (analytics heatmap)
    (22,'Calculus'),(23,'Linear Algebra'),(24,'Data Structures');

-- ---------------------------------------------------------------------------
-- resources
--   pdf_url points at a file in server/storage/seed, served by the app under
--   /files/seed/.  The preview/download endpoints stream it with the right
--   content type, a readable filename and byte-range support, so every row can
--   be opened and downloaded from the viewer.  (PDFs are kept on our own origin:
--   the Cloudinary account has PDF delivery disabled, so `.pdf` URLs 401.)
-- ---------------------------------------------------------------------------
INSERT INTO `resources`
    (resource_id, title, course_id, slot_id, type_id, author_id, professor_id,
     semester_id, quality_score, completeness, upvotes, downloads, views,
     description, pdf_url, created_at) VALUES
    (1, 'BACSE202 — Basic SQL Commands (Lab Manual)', 1, 3, 4, 4, 1, 1,
     92, 90, 64, 180, 640,
     'Course lab manual: SELECT, DDL/DML, joins and constraints with worked statements for every exercise.',
     '/files/seed/bacse202-sql-lab-manual.pdf',
     DATE_SUB(NOW(), INTERVAL 26 DAY)),
    (2, 'BACSE202 — Single-Row & String Function Practice', 1, 1, 2, 3, 1, 1,
     88, 85, 41, 96, 310,
     'Practice set on single-row and string functions over the customer table. Solutions included.',
     '/files/seed/bacse202-sql-functions-practice.pdf',
     DATE_SUB(NOW(), INTERVAL 19 DAY)),
    (3, 'DBMS Indexing — Numerical Practice Problems', 1, 2, 2, 5, 1, 2,
     85, 70, 33, 74, 265,
     'Dense, sparse, primary and secondary indexing problems with worked block-access counts.',
     '/files/seed/dbms-indexing-practice.pdf',
     DATE_SUB(NOW(), INTERVAL 14 DAY)),
    (4, 'BACSE202 — PL/SQL Notes & Examples', 1, 3, 1, 2, 1, 1,
     87, 80, 28, 61, 190,
     'PL/SQL blocks, cursors, procedures and triggers, with the assignment examples annotated.',
     '/files/seed/bacse202-plsql-notes.pdf',
     DATE_SUB(NOW(), INTERVAL 11 DAY)),
    (5, 'BAMAT207 — Standard Normal (z) Tables', 2, 2, 3, 6, 2, 2,
     90, 100, 52, 140, 480,
     'Cumulative z-table scans, printed clean so you can read them in the exam hall.',
     '/files/seed/bamat207-normal-tables.pdf',
     DATE_SUB(NOW(), INTERVAL 8 DAY)),
    (6, 'BAMAT207 — Module 2 Tutorial: Probability Distributions', 2, 1, 2, 7, 2, 1,
     89, 90, 47, 102, 355,
     'Bernoulli, binomial and Poisson application questions with the intended method for each.',
     '/files/seed/bamat207-module2-tutorial.pdf',
     DATE_SUB(NOW(), INTERVAL 6 DAY)),
    (7, 'BAMAT207 — Tutorial 2: Combinatorics & Probability', 2, 5, 2, 6, 2, 2,
     86, 75, 24, 55, 180,
     'Committee-selection and arrangement problems, straight from the tutorial sheet.',
     '/files/seed/bamat207-tutorial-2.pdf',
     DATE_SUB(NOW(), INTERVAL 5 DAY)),
    (8, 'BAMAT207 — Assessment 4 Solutions', 2, 2, 5, 2, 2, 1,
     84, 88, 31, 77, 240,
     'Full worked solution for Assessment 4 — manual method plus the shortcut where it applies.',
     '/files/seed/bamat207-assessment-4-solutions.pdf',
     DATE_SUB(NOW(), INTERVAL 4 DAY)),
    (9, 'BAMAT207 — Assessment 6 Solutions', 2, 1, 5, 2, 2, 1,
     85, 92, 26, 68, 205,
     'Regression and ANOVA working for Assessment 6, with the intermediate tables kept in.',
     '/files/seed/bamat207-assessment-6-solutions.pdf',
     DATE_SUB(NOW(), INTERVAL 3 DAY)),
    (10, 'BACSE203 — Exp 3: Network Topology Lab Report', 3, 4, 4, 5, 3, 2,
     88, 95, 19, 44, 150,
     'Star vs mesh topology comparison with the packet captures and latency readings in the appendix.',
     '/files/seed/bacse203-exp3-lab-report.pdf',
     DATE_SUB(NOW(), INTERVAL 2 DAY)),
    (11, 'BASTS101 — Course Syllabus & Objectives', 4, 5, 1, 4, 4, 1,
     78, 100, 12, 30, 95,
     'Module list, assessment weightings and the syllabus-version note for the skills practice course.',
     '/files/seed/basts101-syllabus.pdf',
     DATE_SUB(NOW(), INTERVAL 1 DAY));

-- ---------------------------------------------------------------------------
-- resource_topics  (resolves Resource.topics[])
-- ---------------------------------------------------------------------------
INSERT INTO `resource_topics` (resource_id, topic_id) VALUES
    (1,9),(1,10),(1,15),
    (2,9),(2,11),
    (3,12),(3,14),
    (4,9),(4,13),
    (5,4),(5,8),
    (6,1),(6,2),
    (7,1),(7,3),
    (8,1),(8,8),
    (9,5),(9,6),(9,7),
    (10,17),(10,18),
    (11,20),(11,21);

-- ---------------------------------------------------------------------------
-- comments  (resolves Resource.comments[]) — weak entity on resource
--   Resource 1's thread is authored by three different students, including an
--   OP reply from the uploader (meera.iyer, user 4).
-- ---------------------------------------------------------------------------
INSERT INTO `comments` (comment_id, resource_id, author_id, comment_text, upvotes, is_op) VALUES
    (1, 1, 6, 'The join examples on page 7 are clearer than the slides. Thank you!', 9, 0),
    (2, 1, 4, 'Glad it helps — I added the NATURAL JOIN caveat on the last page.', 3, 1),
    (3, 1, 5, 'Used this for the lab exam, the constraint section is exactly what they asked.', 14, 0),
    (4, 5, 3, 'Z-table finally readable. Bookmarking this before the quiz.', 6, 0),
    (5, 10, 7, 'Which topology did you use for task 2?', 2, 0),
    (6, 10, 5, 'Star topology — the capture is in the appendix.', 1, 1),
    (7, 9, 6, 'The regression steps match the tutorial method, thanks.', 5, 0);

-- ---------------------------------------------------------------------------
-- course_stats  (maintained aggregates)
--   Placeholder numbers are replaced from the real rows below, so
--   `total_resources`, `quality_avg` and `completeness` always agree with the
--   catalogue instead of being invented.
-- ---------------------------------------------------------------------------
INSERT INTO `course_stats` (course_id, completeness, quality_avg, total_resources) VALUES
    (1, 0, 0, 0),
    (2, 0, 0, 0),
    (3, 0, 0, 0),
    (4, 0, 0, 0);

UPDATE `course_stats` cs
SET
    total_resources = (SELECT COUNT(*) FROM `resources` r WHERE r.course_id = cs.course_id),
    quality_avg     = COALESCE((SELECT ROUND(AVG(r.quality_score)) FROM `resources` r WHERE r.course_id = cs.course_id), 0),
    completeness    = COALESCE((SELECT ROUND(AVG(r.completeness)) FROM `resources` r WHERE r.course_id = cs.course_id), 0);

-- ---------------------------------------------------------------------------
-- course_topic_coverage  (resolves CourseStats.topicCoverage[])
-- ---------------------------------------------------------------------------
INSERT INTO `course_topic_coverage` (course_id, topic_id, coverage) VALUES
    (1, 9, 95),(1, 10, 80),(1, 12, 70),(1, 13, 65),(1, 15, 85),(1, 16, 60),
    (2, 1, 95),(2, 3, 80),(2, 4, 90),(2, 5, 75),(2, 6, 60),(2, 7, 70),(2, 8, 95),
    (3, 17, 85),(3, 18, 60),(3, 19, 45),
    (4, 20, 70),(4, 21, 100);

-- ---------------------------------------------------------------------------
-- course_activity  (resolves CourseStats.activityGrid[]: 364 daily intensities)
--   Deterministic pseudo-random intensity so the seed is reproducible.
-- ---------------------------------------------------------------------------
INSERT INTO `course_activity` (course_id, activity_date, intensity)
SELECT
    c.course_id,
    DATE_SUB(CURDATE(), INTERVAL (363 - n.d) DAY) AS activity_date,
    CASE
        WHEN ((n.d * 7 + c.course_id * 13) % 10) > 6
            THEN ((n.d * 3 + c.course_id * 5) % 4) + 1
        ELSE 0
    END AS intensity
FROM `courses` c
CROSS JOIN (
    SELECT a.i + b.i * 10 + e.i * 100 AS d
    FROM (SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
          UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
    CROSS JOIN (SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
          UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
    CROSS JOIN (SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) e
) n
WHERE n.d < 364;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT 'users' AS table_name, COUNT(*) AS rows_loaded FROM users
UNION ALL SELECT 'courses',           COUNT(*) FROM courses
UNION ALL SELECT 'slots',             COUNT(*) FROM slots
UNION ALL SELECT 'resource_types',    COUNT(*) FROM resource_types
UNION ALL SELECT 'topics',            COUNT(*) FROM topics
UNION ALL SELECT 'professors',        COUNT(*) FROM professors
UNION ALL SELECT 'semesters',         COUNT(*) FROM semesters
UNION ALL SELECT 'resources',         COUNT(*) FROM resources
UNION ALL SELECT 'resource_topics',   COUNT(*) FROM resource_topics
UNION ALL SELECT 'comments',          COUNT(*) FROM comments
UNION ALL SELECT 'course_stats',      COUNT(*) FROM course_stats
UNION ALL SELECT 'course_topic_coverage', COUNT(*) FROM course_topic_coverage
UNION ALL SELECT 'course_activity',   COUNT(*) FROM course_activity;

SET FOREIGN_KEY_CHECKS = 1;
