<?php
defined('MOODLE_INTERNAL') || die();

function xmldb_report_accessaudit_upgrade($oldversion) {
    global $DB;
    $dbman = $DB->get_manager();

    if ($oldversion < 2024020100) {
        // Criar tabela report_accessaudit_patterns (versão original)
        $table = new xmldb_table('report_accessaudit_patterns');

        $table->add_field('id',           XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL, XMLDB_SEQUENCE);
        $table->add_field('ip',           XMLDB_TYPE_CHAR,    '45',  null, XMLDB_NOTNULL, null, '');
        $table->add_field('courseid',     XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);
        $table->add_field('coursename',   XMLDB_TYPE_CHAR,    '255', null, null,          null, '');
        $table->add_field('pattern_type', XMLDB_TYPE_CHAR,    '20',  null, XMLDB_NOTNULL, null, '');
        $table->add_field('userids',      XMLDB_TYPE_TEXT,    null,  null, XMLDB_NOTNULL);
        $table->add_field('usernames',    XMLDB_TYPE_TEXT,    null,  null, null);
        $table->add_field('detail_json',  XMLDB_TYPE_TEXT,    null,  null, null);
        $table->add_field('risk_level',   XMLDB_TYPE_CHAR,    '10',  null, null,          null, 'medium');
        $table->add_field('timecreated',  XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);

        $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
        $table->add_index('ip', XMLDB_INDEX_NOTUNIQUE, ['ip']);
        $table->add_index('courseid', XMLDB_INDEX_NOTUNIQUE, ['courseid']);
        $table->add_index('timecreated', XMLDB_INDEX_NOTUNIQUE, ['timecreated']);

        if (!$dbman->table_exists($table)) {
            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2024020100, 'report', 'accessaudit');
    }

    // Versão 2024020101 — garante criação da tabela patterns em instâncias já instaladas com v2.0
    if ($oldversion < 2024020101) {
        $table = new xmldb_table('report_accessaudit_patterns');

        if (!$dbman->table_exists($table)) {
            $table->add_field('id',           XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL, XMLDB_SEQUENCE);
            $table->add_field('ip',           XMLDB_TYPE_CHAR,    '45',  null, XMLDB_NOTNULL, null, '');
            $table->add_field('courseid',     XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);
            $table->add_field('coursename',   XMLDB_TYPE_CHAR,    '255', null, null,          null, '');
            $table->add_field('pattern_type', XMLDB_TYPE_CHAR,    '20',  null, XMLDB_NOTNULL, null, '');
            $table->add_field('userids',      XMLDB_TYPE_TEXT,    null,  null, XMLDB_NOTNULL);
            $table->add_field('usernames',    XMLDB_TYPE_TEXT,    null,  null, null);
            $table->add_field('detail_json',  XMLDB_TYPE_TEXT,    null,  null, null);
            $table->add_field('risk_level',   XMLDB_TYPE_CHAR,    '10',  null, null,          null, 'medium');
            $table->add_field('timecreated',  XMLDB_TYPE_INTEGER, '10',  null, XMLDB_NOTNULL);

            $table->add_key('primary', XMLDB_KEY_PRIMARY, ['id']);
            $table->add_index('ip', XMLDB_INDEX_NOTUNIQUE, ['ip']);
            $table->add_index('courseid', XMLDB_INDEX_NOTUNIQUE, ['courseid']);
            $table->add_index('timecreated', XMLDB_INDEX_NOTUNIQUE, ['timecreated']);

            $dbman->create_table($table);
        }

        upgrade_plugin_savepoint(true, 2024020101, 'report', 'accessaudit');
    }

    return true;
}
