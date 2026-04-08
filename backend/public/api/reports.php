<?php
require_once __DIR__ . '/_bootstrap.php';

try {
    $actor = auth_roles(['admin', 'reseller']);

    $year = max(2000, (int)($_GET['year'] ?? date('Y')));
    $start = $year . '-01-01';
    $end = $year . '-12-31';

    if ($actor['role'] === 'reseller') {
        $resellerId = (int)$actor['id'];
    } else {
        $resellerId = isset($_GET['reseller_id']) && $_GET['reseller_id'] !== '' ? (int)$_GET['reseller_id'] : null;
    }

    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(500, max(1, (int)($_GET['limit'] ?? 500)));
    $offset = ($page - 1) * $limit;
    $q = trim($_GET['q'] ?? '');

    $conditions = ['o.order_date BETWEEN ? AND ?'];
    $params = [$start, $end];

    if ($resellerId) {
        $conditions[] = 'o.reseller_id = ?';
        $params[] = $resellerId;
    }
    if ($q !== '') {
        $conditions[] = 'c.name LIKE ?';
        $params[] = '%' . $q . '%';
    }

    $whereSql = 'WHERE ' . implode(' AND ', $conditions);

    $countSql = "SELECT COUNT(*)
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN resellers r ON r.id = o.reseller_id
        " . $whereSql;
    $countStmt = $db->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $summarySql = "SELECT
            COUNT(*) AS order_count,
            COALESCE(SUM(o.total_amount), 0) AS sum_total_amount,
            COALESCE(SUM(o.amount_paid), 0) AS sum_amount_paid,
            COALESCE(SUM(GREATEST(o.total_amount - o.amount_paid, 0)), 0) AS sum_remaining_amount,
            SUM(CASE WHEN o.payment_status = 'belum_lunas' THEN 1 ELSE 0 END) AS count_belum_lunas,
            SUM(CASE WHEN o.payment_status = 'lunas' THEN 1 ELSE 0 END) AS count_lunas
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN resellers r ON r.id = o.reseller_id
        " . $whereSql;
    $summaryStmt = $db->prepare($summarySql);
    $summaryStmt->execute($params);
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $daysRemainingSql = "CASE WHEN o.payment_status = 'lunas' THEN 0
        ELSE GREATEST(COALESCE(o.payment_days_target, 0) - COALESCE(o.payment_days_total, 0), 0) END";

    $sql = "SELECT o.id, o.order_date, o.total_amount, o.amount_paid, o.payment_days_total, o.payment_days_target,
               o.payment_status,
               GREATEST(o.total_amount - o.amount_paid, 0) AS remaining_amount,
               {$daysRemainingSql} AS payment_days_remaining,
               c.name AS customer_name,
               c.phone AS customer_phone,
               r.name AS reseller_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN resellers r ON r.id = o.reseller_id
        " . $whereSql . "
        ORDER BY o.order_date DESC, o.id DESC
        LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    json_response($rows, 200, [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'total_pages' => (int)ceil($total / $limit),
        'year' => $year,
        'summary' => [
            'order_count' => (int)($summary['order_count'] ?? 0),
            'sum_total_amount' => (float)($summary['sum_total_amount'] ?? 0),
            'sum_amount_paid' => (float)($summary['sum_amount_paid'] ?? 0),
            'sum_remaining_amount' => (float)($summary['sum_remaining_amount'] ?? 0),
            'count_belum_lunas' => (int)($summary['count_belum_lunas'] ?? 0),
            'count_lunas' => (int)($summary['count_lunas'] ?? 0),
        ],
    ]);
} catch (Throwable $e) {
    error_log('REPORTS ERROR: ' . $e->getMessage());
    json_response(['message' => 'Gagal memuat laporan'], 500);
}
