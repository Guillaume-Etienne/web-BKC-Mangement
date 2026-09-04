import type { Tr } from './types'

export const commonI18n = {
  // Buttons
  btn_add:        { fr: 'Ajouter',      en: 'Add',         es: 'Añadir' },
  btn_edit:       { fr: 'Modifier',     en: 'Edit',        es: 'Editar' },
  btn_delete:     { fr: 'Supprimer',    en: 'Delete',      es: 'Eliminar' },
  btn_cancel:     { fr: 'Annuler',      en: 'Cancel',      es: 'Cancelar' },
  btn_save:       { fr: 'Enregistrer',  en: 'Save',        es: 'Guardar' },
  btn_close:      { fr: 'Fermer',       en: 'Close',       es: 'Cerrar' },
  btn_back:       { fr: 'Retour',       en: 'Back',        es: 'Atrás' },
  btn_next:       { fr: 'Suivant',      en: 'Next',        es: 'Siguiente' },
  btn_submit:     { fr: 'Envoyer',      en: 'Submit',      es: 'Enviar' },
  btn_search:     { fr: 'Chercher',     en: 'Search',      es: 'Buscar' },
  btn_filter:     { fr: 'Filtrer',      en: 'Filter',      es: 'Filtrar' },
  btn_export:     { fr: 'Exporter',     en: 'Export',      es: 'Exportar' },
  btn_import:     { fr: 'Importer',     en: 'Import',      es: 'Importar' },

  // Common labels
  label_name:     { fr: 'Nom',          en: 'Name',        es: 'Nombre' },
  label_email:    { fr: 'Email',        en: 'Email',       es: 'Correo' },
  label_phone:    { fr: 'Téléphone',    en: 'Phone',       es: 'Teléfono' },
  label_date:     { fr: 'Date',         en: 'Date',        es: 'Fecha' },
  label_status:   { fr: 'Statut',       en: 'Status',      es: 'Estado' },
  label_notes:    { fr: 'Notes',        en: 'Notes',       es: 'Notas' },
  label_amount:   { fr: 'Montant',      en: 'Amount',      es: 'Cantidad' },
  label_price:    { fr: 'Prix',         en: 'Price',       es: 'Precio' },
  label_quantity: { fr: 'Quantité',     en: 'Quantity',    es: 'Cantidad' },
  label_total:    { fr: 'Total',        en: 'Total',       es: 'Total' },
  label_yes:      { fr: 'Oui',          en: 'Yes',         es: 'Sí' },
  label_no:       { fr: 'Non',          en: 'No',          es: 'No' },
  label_active:   { fr: 'Actif',        en: 'Active',      es: 'Activo' },
  label_inactive: { fr: 'Inactif',      en: 'Inactive',    es: 'Inactivo' },

  // Messages
  msg_loading:    { fr: 'Chargement…',  en: 'Loading…',    es: 'Cargando…' },
  msg_error:      { fr: 'Erreur',       en: 'Error',       es: 'Error' },
  msg_success:    { fr: 'Succès',       en: 'Success',     es: 'Éxito' },
  msg_warning:    { fr: 'Avertissement', en: 'Warning',    es: 'Advertencia' },
  msg_info:       { fr: 'Information',  en: 'Information', es: 'Información' },
  msg_confirm:    { fr: 'Êtes-vous sûr ?', en: 'Are you sure?', es: '¿Estás seguro?' },
  msg_required:   { fr: 'Requis',       en: 'Required',    es: 'Requerido' },
  msg_optional:   { fr: 'Optionnel',    en: 'Optional',    es: 'Opcional' },

  // Time periods
  period_today:   { fr: 'Aujourd\'hui', en: 'Today',       es: 'Hoy' },
  period_yesterday: { fr: 'Hier',       en: 'Yesterday',   es: 'Ayer' },
  period_week:    { fr: 'Cette semaine', en: 'This week',  es: 'Esta semana' },
  period_month:   { fr: 'Ce mois',      en: 'This month',  es: 'Este mes' },
  period_year:    { fr: 'Cette année',  en: 'This year',   es: 'Este año' },
  period_all_time: { fr: 'Tout le temps', en: 'All time',  es: 'Todo el tiempo' },
} satisfies Record<string, Tr>
