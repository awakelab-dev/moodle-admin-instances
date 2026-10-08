<?php
require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/adminlib.php');

admin_externalpage_setup('report_accessaudit');
require_capability('report/accessaudit:view', context_system::instance());

$tab    = optional_param('tab',    'locations',  PARAM_ALPHA);
$filter = optional_param('filter', 'suspicious', PARAM_ALPHA);

$PAGE->set_title(get_string('pagetitle', 'report_accessaudit'));
$PAGE->set_heading(get_string('pagetitle', 'report_accessaudit'));
$PAGE->requires->css(new moodle_url('/report/accessaudit/styles.css'));

echo $OUTPUT->header();

// ── Abas principais ──────────────────────────────────────────────────────────
$url_tab_loc  = new moodle_url('/report/accessaudit/index.php', ['tab' => 'locations']);
$url_tab_pat  = new moodle_url('/report/accessaudit/index.php', ['tab' => 'patterns']);

echo html_writer::start_div('report-accessaudit-tabs mb-4');
echo html_writer::link($url_tab_loc, '🌍 ' . get_string('tab_locations', 'report_accessaudit'),
    ['class' => 'btn btn-sm ' . ($tab === 'locations' ? 'btn-primary' : 'btn-outline-secondary') . ' mr-2']);
echo html_writer::link($url_tab_pat, '🔍 ' . get_string('tab_patterns', 'report_accessaudit'),
    ['class' => 'btn btn-sm ' . ($tab === 'patterns' ? 'btn-primary' : 'btn-outline-secondary')]);
echo html_writer::end_div();

global $DB;

// ════════════════════════════════════════════════════════════════════════════
// ABA 1 — LOCALIZAÇÃO (lógica original)
// ════════════════════════════════════════════════════════════════════════════
if ($tab === 'locations') {

    $url_all        = new moodle_url('/report/accessaudit/index.php', ['tab' => 'locations', 'filter' => 'all']);
    $url_suspicious = new moodle_url('/report/accessaudit/index.php', ['tab' => 'locations', 'filter' => 'suspicious']);

    echo html_writer::start_div('report-accessaudit-filters mb-3');
    echo html_writer::link($url_suspicious, get_string('filter_suspicious', 'report_accessaudit'),
        ['class' => 'btn btn-sm ' . ($filter === 'suspicious' ? 'btn-danger' : 'btn-outline-secondary') . ' mr-2']);
    echo html_writer::link($url_all, get_string('filter_all', 'report_accessaudit'),
        ['class' => 'btn btn-sm ' . ($filter === 'all' ? 'btn-primary' : 'btn-outline-secondary')]);
    echo html_writer::end_div();

    $admin_ids = array_keys(get_admins());
    $admin_placeholders = implode(',', array_fill(0, count($admin_ids), '?'));

    $sql = "SELECT userid, COUNT(DISTINCT region) as regions_count, COUNT(DISTINCT country) as countries_count
            FROM {report_accessaudit}
            WHERE userid NOT IN ($admin_placeholders)
            GROUP BY userid
            ORDER BY regions_count DESC, countries_count DESC";

    $user_stats = $DB->get_records_sql($sql, $admin_ids);

    if (empty($user_stats)) {
        echo $OUTPUT->notification(get_string('no_records', 'report_accessaudit'), 'info');
        echo $OUTPUT->footer();
        exit;
    }

    $table = new html_table();
    $table->head = [
        get_string('fullname',          'report_accessaudit'),
        get_string('username',          'report_accessaudit'),
        get_string('email',             'report_accessaudit'),
        get_string('locations_detected','report_accessaudit'),
        get_string('access', 'report_accessaudit') . ' 1',
        get_string('access', 'report_accessaudit') . ' 2',
        get_string('access', 'report_accessaudit') . ' 3',
        'Estado',
    ];
    $table->attributes['class'] = 'generaltable table table-hover report-accessaudit-table';

    foreach ($user_stats as $stat) {
        $is_suspicious = ($stat->regions_count > 1 || $stat->countries_count > 1);
        if ($filter === 'suspicious' && !$is_suspicious) continue;

        $user = $DB->get_record('user', ['id' => $stat->userid], 'id, firstname, lastname, username, email');
        if (!$user) continue;

        $accesses = array_values($DB->get_records('report_accessaudit',
            ['userid' => $stat->userid], 'timecreated DESC', '*', 0, 3));

        $access_cells = [];
        for ($i = 0; $i < 3; $i++) {
            if (isset($accesses[$i])) {
                $a = $accesses[$i];
                $access_cells[] = html_writer::div(
                    html_writer::tag('strong', $a->ip) . html_writer::empty_tag('br') .
                    '📍 ' . htmlspecialchars($a->city) . ', ' . htmlspecialchars($a->region) . html_writer::empty_tag('br') .
                    '🌍 ' . htmlspecialchars($a->country) . html_writer::empty_tag('br') .
                    '🕐 ' . userdate($a->timecreated, '%d/%m/%Y %H:%M'),
                    'access-cell'
                );
            } else {
                $access_cells[] = html_writer::div('—', 'access-cell text-muted');
            }
        }

        $status_badge = $is_suspicious
            ? html_writer::span(get_string('suspicious', 'report_accessaudit'), 'badge badge-danger')
            : html_writer::span(get_string('normal',    'report_accessaudit'), 'badge badge-success');

        $row = new html_table_row([
            fullname($user),
            $user->username,
            $user->email,
            html_writer::tag('strong', $stat->regions_count . ' estado(s), ' . $stat->countries_count . ' país(es)'),
            $access_cells[0], $access_cells[1], $access_cells[2],
            $status_badge,
        ]);
        if ($is_suspicious) $row->attributes['class'] = 'table-warning';
        $table->data[] = $row;
    }

    if (empty($table->data)) {
        echo $OUTPUT->notification(get_string('no_records', 'report_accessaudit'), 'info');
    } else {
        echo html_writer::table($table);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// ABA 2 — PADRÕES SUSPEITOS
// ════════════════════════════════════════════════════════════════════════════
if ($tab === 'patterns') {

    // Informação: análise automática via cron (sem botão manual)
    echo html_writer::tag('p',
        '🕒 ' . get_string('analyze_hint', 'report_accessaudit'),
        ['class' => 'text-muted small mb-4']);

    // Buscar resultados já processados
    $patterns = $DB->get_records('report_accessaudit_patterns', null, 'timecreated DESC');

    if (empty($patterns)) {
        echo $OUTPUT->notification(get_string('no_patterns_yet', 'report_accessaudit'), 'info');
        echo $OUTPUT->footer();
        exit;
    }

    // Mostrar data da última análise
    $last = reset($patterns);
    echo html_writer::tag('p',
        get_string('last_analysis', 'report_accessaudit') . ': ' .
        html_writer::tag('strong', userdate($last->timecreated, '%d/%m/%Y %H:%M')),
        ['class' => 'text-muted small mb-3']
    );

    // Filtro por padrão
    $url_all_p  = new moodle_url('/report/accessaudit/index.php', ['tab' => 'patterns', 'filter' => 'all']);
    $url_seq    = new moodle_url('/report/accessaudit/index.php', ['tab' => 'patterns', 'filter' => 'sequential']);
    $url_sim    = new moodle_url('/report/accessaudit/index.php', ['tab' => 'patterns', 'filter' => 'simultaneous']);

    echo html_writer::start_div('mb-3');
    foreach ([
        ['all',           get_string('filter_all',          'report_accessaudit'), $url_all_p,  'btn-secondary'],
        ['sequential',    get_string('pattern_sequential',   'report_accessaudit'), $url_seq,    'btn-info'],
        ['simultaneous',  get_string('pattern_simultaneous', 'report_accessaudit'), $url_sim,    'btn-purple'],
    ] as [$val, $label, $url, $color]) {
        echo html_writer::link($url, $label,
            ['class' => 'btn btn-sm mr-2 ' . ($filter === $val ? $color : 'btn-outline-secondary')]);
    }
    echo html_writer::end_div();

    $table = new html_table();
    $table->head = [
        'IP',
        get_string('course'),
        get_string('pattern_type',   'report_accessaudit'),
        get_string('students_count', 'report_accessaudit'),
        get_string('risk_level',     'report_accessaudit'),
        get_string('detail',         'report_accessaudit'),
    ];
    $table->attributes['class'] = 'generaltable table table-hover report-accessaudit-table';

    foreach ($patterns as $p) {
        // Filtro por padrão
        if ($filter !== 'all' && $filter !== '' && $p->pattern_type !== $filter && $p->pattern_type !== 'both') {
            continue;
        }

        $userids   = json_decode($p->userids, true)   ?? [];
        $usernames = json_decode($p->usernames, true)  ?? [];
        $detail    = json_decode($p->detail_json, true) ?? [];

        // Badge de padrão
        $pat_label = match($p->pattern_type) {
            'sequential'   => html_writer::span('⏩ ' . get_string('pattern_sequential',   'report_accessaudit'), 'badge badge-info'),
            'simultaneous' => html_writer::span('⚡ ' . get_string('pattern_simultaneous', 'report_accessaudit'), 'badge badge-purple'),
            'both'         => html_writer::span('🚨 ' . get_string('pattern_both',         'report_accessaudit'), 'badge badge-danger'),
            default        => html_writer::span($p->pattern_type, 'badge badge-secondary'),
        };

        // Badge de risco
        $risk_badge = match($p->risk_level) {
            'high'   => html_writer::span('🔴 ' . get_string('risk_high',   'report_accessaudit'), 'badge badge-danger'),
            'medium' => html_writer::span('🟡 ' . get_string('risk_medium', 'report_accessaudit'), 'badge badge-warning'),
            default  => html_writer::span('🟢 ' . get_string('risk_low',    'report_accessaudit'), 'badge badge-success'),
        };

        // Nomes dos alunos
        $names_html = html_writer::start_tag('ul', ['class' => 'pattern-users-list mb-0']);
        foreach ($userids as $uid) {
            $name = $usernames[$uid] ?? "Usuário $uid";
            $avg  = isset($detail[$uid]) ? (int)($detail[$uid]['avg_time'] ?? 0) : 0;
            $warn = ($avg > 0 && $avg < \report_accessaudit\analyzer::MIN_VIEW_TIME) ? ' ⚠️' : '';
            $avg_str = $avg > 0 ? " <small class='text-muted'>({$avg}s/recurso{$warn})</small>" : '';
            $names_html .= html_writer::tag('li', htmlspecialchars($name) . $avg_str);
        }
        $names_html .= html_writer::end_tag('ul');

        $row = new html_table_row([
            html_writer::tag('code', htmlspecialchars($p->ip)),
            htmlspecialchars($p->coursename),
            $pat_label,
            $names_html,
            $risk_badge,
            html_writer::tag('small',
                userdate($p->timecreated, '%d/%m %H:%M'),
                ['class' => 'text-muted']),
        ]);

        $row->attributes['class'] = match($p->risk_level) {
            'high'   => 'table-danger',
            'medium' => 'table-warning',
            default  => '',
        };

        $table->data[] = $row;
    }

    if (empty($table->data)) {
        echo $OUTPUT->notification(get_string('no_patterns_filtered', 'report_accessaudit'), 'info');
    } else {
        echo html_writer::table($table);
    }
}

echo $OUTPUT->footer();
