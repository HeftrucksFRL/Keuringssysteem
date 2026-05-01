<?php
/**
 * Forminator nummerexport voor Code Snippets
 *
 * Doel:
 * - exporteert oude Forminator entry-nummers
 * - koppelt die aan form_id en inzendingstijd
 * - alleen zichtbaar voor admins in wp-admin
 *
 * Gebruik:
 * 1. Plak deze code in de plugin "Code Snippets"
 * 2. Activeer de snippet
 * 3. Ga in WordPress naar Extra > Forminator nummerexport
 * 4. Klik op "Download CSV"
 * 5. Zet de snippet daarna weer uit
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_menu', function () {
    add_management_page(
        'Forminator nummerexport',
        'Forminator nummerexport',
        'manage_options',
        'forminator-nummerexport',
        'hf_forminator_nummerexport_page'
    );
});

add_action('admin_post_hf_forminator_nummerexport', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Je hebt geen rechten om deze export uit te voeren.');
    }

    check_admin_referer('hf_forminator_nummerexport');

    global $wpdb;

    $table = $wpdb->prefix . 'frmt_form_entry';

    $table_exists = $wpdb->get_var(
        $wpdb->prepare('SHOW TABLES LIKE %s', $table)
    );

    if ($table_exists !== $table) {
        wp_die(
            'De Forminator entries-tabel is niet gevonden. Controleer of Forminator submissions opslaat in deze WordPress-installatie.'
        );
    }

    $results = $wpdb->get_results(
        "
        SELECT
            entry_id AS oud_nummer,
            form_id,
            entry_type,
            date_created AS inzendingstijd
        FROM {$table}
        WHERE date_created >= '2021-01-01 00:00:00'
        ORDER BY date_created ASC, entry_id ASC
        ",
        ARRAY_A
    );

    $filename = 'forminator-nummers-' . gmdate('Y-m-d-His') . '.csv';

    nocache_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=' . $filename);

    $output = fopen('php://output', 'w');

    // Excel-vriendelijk voor NL-omgevingen.
    fwrite($output, "\xEF\xBB\xBF");

    fputcsv($output, ['oud_nummer', 'form_id', 'entry_type', 'inzendingstijd'], ';');

    foreach ($results as $row) {
        fputcsv(
            $output,
            [
                $row['oud_nummer'],
                $row['form_id'],
                $row['entry_type'],
                $row['inzendingstijd'],
            ],
            ';'
        );
    }

    fclose($output);
    exit;
});

function hf_forminator_nummerexport_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>Forminator nummerexport</h1>
        <p>
            Download hier een CSV met oude Forminator entry-nummers, formulier-ID's en inzendingstijden.
        </p>
        <p>
            Deze export is alleen bedoeld om de oude keuringsnummers terug te koppelen aan de detail-CSV's.
        </p>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="hf_forminator_nummerexport">
            <?php wp_nonce_field('hf_forminator_nummerexport'); ?>
            <?php submit_button('Download CSV'); ?>
        </form>
    </div>
    <?php
}
