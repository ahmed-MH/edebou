import type { AppLocale } from "@/i18n/routing";

export const commerceCopy = {
  ar: {
    header: {
      cart: "السلة",
      cartLabel: (count: number) => `سلة التسوق، ${count} منتج`,
    },
    common: {
      loading: "جارٍ التحقق من المنتجات…",
      loadErrorTitle: "تعذّر التحقق من السلة",
      loadErrorBody: "تحقق من اتصالك ثم أعد المحاولة. لم يتم حذف أي منتج.",
      retry: "إعادة المحاولة",
      browseProducts: "تصفّح المنتجات",
      quantity: "الكمية",
      remove: "حذف",
      unavailable: "لم يعد هذا المنتج متاحًا.",
      outOfStock: "غير متوفر حاليًا.",
      availability: {
        IN_STOCK: "متوفر",
        LOW_STOCK: "كمية محدودة",
        OUT_OF_STOCK: "غير متوفر",
      },
      unitPrice: "سعر الوحدة التقديري",
      averageUnitPrice: "متوسط سعر الوحدة التقريبي",
      lineTotal: "المجموع التقديري",
      subtotal: "المجموع الفرعي",
      indicativeNotice:
        "الأسعار المعروضة إرشادية. يعيد الخادم حساب الأسعار والكميات المتاحة عند تأكيد الطلب.",
    },
    cart: {
      eyebrow: "سلة التسوق",
      title: "راجع مشترياتك",
      description: "عدّل الكميات قبل الانتقال إلى تأكيد معلومات التوصيل.",
      emptyTitle: "سلتك فارغة",
      emptyBody: "أضف منتجات من الكتالوج لتبدأ طلبك.",
      clear: "إفراغ السلة",
      summary: "ملخص السلة",
      checkout: "الانتقال إلى إتمام الطلب",
      checkoutBlocked: "احذف المنتجات غير المتوفرة للمتابعة.",
      itemCount: (count: number) => `${count} وحدة في السلة`,
    },
    checkout: {
      eyebrow: "إتمام الطلب",
      title: "معلومات التوصيل",
      description:
        "أدخل معلومات صحيحة حتى نتمكن من تأكيد طلبك وتسليمه داخل تونس.",
      directOrderEyebrow: "طلب مباشر",
      directOrderTitle: "اطلب هذا المنتج من نفس الصفحة",
      directOrderDescription:
        "اختر العرض والكمية، أدخل معلومات التوصيل، ثم أكّد طلبك. سيُعاد التحقق من السعر والتوفر عند التأكيد.",
      emptyTitle: "لا يمكن إتمام طلب فارغ",
      emptyBody: "ارجع إلى الكتالوج وأضف منتجًا واحدًا على الأقل.",
      backToCart: "العودة إلى السلة",
      summary: "ملخص الطلب",
      deliveryFee: "مصاريف التوصيل",
      total: "المجموع",
      fields: {
        fullName: "الاسم الأول",
        fullNamePlaceholder: "أدخل اسمك الأول",
        phone: "الهاتف",
        phonePlaceholder: "أدخل رقم هاتفك",
        phoneHelp: "أدخل 8 أرقام تونسية، مع أو بدون +216.",
        governorate: "الولاية",
        governoratePlaceholder: "اختر الولاية",
        address: "العنوان 1",
        addressPlaceholder: "أدخل عنوانك",
      },
      validation: {
        fullName: "أدخل اسمًا أول صالحًا (من 2 إلى 120 حرفًا).",
        phone: "أدخل رقمًا تونسيًا صالحًا من 8 أرقام.",
        governorate: "اختر ولاية.",
        address: "أدخل عنوانًا واضحًا (من 8 إلى 300 حرف).",
      },
      paymentTitle: "طريقة الدفع",
      cashOnDelivery: "الدفع عند الاستلام",
      cashOnDeliveryHelp:
        "لن يُطلب منك إدخال بيانات بطاقة أو إجراء دفع عبر الإنترنت.",
      draftPrivacyNotice:
        "بعد إدخال رقم هاتف صالح، تُحفظ هذه المعلومات مؤقتًا لمساعدتنا على متابعة طلبك غير المكتمل. يمكنك طلب حذفها في أي وقت.",
      submit: "تأكيد الطلب",
      submitting: "جارٍ تأكيد الطلب…",
      unavailableCart: "عدّل المنتجات غير المتوفرة في السلة قبل المتابعة.",
      errors: {
        INVALID_REQUEST: "تحقق من المعلومات والكميات ثم أعد المحاولة.",
        FORBIDDEN_REQUEST: "تعذّر التحقق من أمان الطلب. حدّث الصفحة وحاول مجددًا.",
        IDEMPOTENCY_CONFLICT: "تغيّر الطلب أثناء الإرسال. راجعه وحاول مجددًا.",
        ORDER_UNAVAILABLE: "تغيّر توفر أحد المنتجات. ارجع إلى السلة وراجع طلبك.",
        RATE_LIMITED: "محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.",
        SERVICE_UNAVAILABLE: "الخدمة غير متاحة حاليًا. لم يتم تأكيد الطلب.",
        INTERNAL_ERROR: "حدث خطأ غير متوقع. لم يتم عرض تأكيد للطلب.",
        UNKNOWN: "تعذّر تأكيد الطلب. لم يتم إنشاء تأكيد وهمي.",
      },
      successEyebrow: "تم استلام الطلب",
      successTitle: "شكرًا، تم تأكيد طلبك",
      orderNumber: "رقم الطلب",
      successTotal: "المبلغ الإجمالي",
      successPayment: "سيتم الدفع نقدًا عند الاستلام.",
      successPrivacy:
        "احتفظ برقم الطلب. لا تُعرض معلومات التوصيل في الرابط أو في صفحة عامة.",
      continueShopping: "متابعة التسوق",
    },
  },
  fr: {
    header: {
      cart: "Panier",
      cartLabel: (count: number) =>
        `Panier, ${count} article${count > 1 ? "s" : ""}`,
    },
    common: {
      loading: "Vérification des produits…",
      loadErrorTitle: "Impossible de vérifier le panier",
      loadErrorBody:
        "Vérifiez votre connexion puis réessayez. Aucun article n’a été supprimé.",
      retry: "Réessayer",
      browseProducts: "Voir les produits",
      quantity: "Quantité",
      remove: "Supprimer",
      unavailable: "Ce produit n’est plus disponible.",
      outOfStock: "Ce produit est actuellement en rupture.",
      availability: {
        IN_STOCK: "En stock",
        LOW_STOCK: "Stock limité",
        OUT_OF_STOCK: "Indisponible",
      },
      unitPrice: "Prix unitaire indicatif",
      averageUnitPrice: "Prix moyen indicatif par article",
      lineTotal: "Total indicatif",
      subtotal: "Sous-total",
      indicativeNotice:
        "Les montants affichés sont indicatifs. Le serveur recalcule les prix et vérifie les stocks à la confirmation.",
    },
    cart: {
      eyebrow: "Votre panier",
      title: "Vérifiez vos achats",
      description:
        "Ajustez les quantités avant de renseigner vos informations de livraison.",
      emptyTitle: "Votre panier est vide",
      emptyBody: "Ajoutez des produits du catalogue pour commencer votre commande.",
      clear: "Vider le panier",
      summary: "Récapitulatif du panier",
      checkout: "Finaliser la commande",
      checkoutBlocked: "Retirez les produits indisponibles pour continuer.",
      itemCount: (count: number) =>
        `${count} unité${count > 1 ? "s" : ""} dans le panier`,
    },
    checkout: {
      eyebrow: "Finalisation de la commande",
      title: "Informations de livraison",
      description:
        "Renseignez des coordonnées exactes afin que nous puissions confirmer et livrer votre commande en Tunisie.",
      directOrderEyebrow: "Commande directe",
      directOrderTitle: "Commandez depuis cette page",
      directOrderDescription:
        "Choisissez l’offre et la quantité, renseignez vos coordonnées, puis confirmez. Le prix et le stock seront revérifiés.",
      emptyTitle: "Impossible de commander un panier vide",
      emptyBody: "Retournez au catalogue et ajoutez au moins un produit.",
      backToCart: "Retour au panier",
      summary: "Récapitulatif de la commande",
      deliveryFee: "Frais de livraison",
      total: "Total",
      fields: {
        fullName: "Prénom",
        fullNamePlaceholder: "Saisissez votre prénom",
        phone: "Téléphone",
        phonePlaceholder: "Saisissez votre téléphone",
        phoneHelp: "Saisissez 8 chiffres tunisiens, avec ou sans +216.",
        governorate: "Gouvernorat",
        governoratePlaceholder: "Choisir un gouvernorat",
        address: "Adresse 1",
        addressPlaceholder: "Saisissez votre adresse",
      },
      validation: {
        fullName: "Saisissez un prénom valide (2 à 120 caractères).",
        phone: "Saisissez un numéro tunisien valide à 8 chiffres.",
        governorate: "Choisissez un gouvernorat.",
        address: "Saisissez une adresse précise (8 à 300 caractères).",
      },
      paymentTitle: "Mode de paiement",
      cashOnDelivery: "Paiement à la livraison",
      cashOnDeliveryHelp:
        "Aucune carte bancaire et aucun paiement en ligne ne vous seront demandés.",
      draftPrivacyNotice:
        "Après la saisie d’un numéro valide, ces informations sont enregistrées temporairement afin de vous aider à finaliser une demande incomplète. Vous pouvez demander leur suppression à tout moment.",
      submit: "Confirmer la commande",
      submitting: "Confirmation en cours…",
      unavailableCart:
        "Corrigez les produits indisponibles dans le panier avant de continuer.",
      errors: {
        INVALID_REQUEST: "Vérifiez vos coordonnées et les quantités puis réessayez.",
        FORBIDDEN_REQUEST:
          "La sécurité de la requête n’a pas pu être vérifiée. Actualisez la page puis réessayez.",
        IDEMPOTENCY_CONFLICT:
          "La commande a changé pendant l’envoi. Vérifiez-la puis réessayez.",
        ORDER_UNAVAILABLE:
          "La disponibilité d’un produit a changé. Revenez au panier pour le vérifier.",
        RATE_LIMITED:
          "Trop de tentatives en peu de temps. Patientez puis réessayez.",
        SERVICE_UNAVAILABLE:
          "Le service est momentanément indisponible. La commande n’est pas confirmée.",
        INTERNAL_ERROR:
          "Une erreur inattendue est survenue. Aucune confirmation n’est affichée.",
        UNKNOWN:
          "Impossible de confirmer la commande. Aucune fausse confirmation n’est affichée.",
      },
      successEyebrow: "Commande reçue",
      successTitle: "Merci, votre commande est confirmée",
      orderNumber: "Numéro de commande",
      successTotal: "Montant total",
      successPayment: "Le règlement se fera en espèces à la livraison.",
      successPrivacy:
        "Conservez ce numéro. Vos coordonnées ne figurent ni dans l’URL ni sur une page publique.",
      continueShopping: "Continuer mes achats",
    },
  },
} as const satisfies Record<AppLocale, unknown>;

export type CommerceCopy = (typeof commerceCopy)[AppLocale];
