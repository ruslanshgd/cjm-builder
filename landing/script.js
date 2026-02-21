var I18N = {
  ru: {
    'nav.logo': 'Сборка CJM',
    'nav.features': 'Возможности',
    'nav.modes': 'Режимы',
    'nav.settings': 'Настройки',
    'nav.start': 'Начать',
    'nav.donate': 'Поблагодарить',
    'nav.download': 'Скачать',

    'hero.badge': 'Бесплатный плагин для Figma',
    'hero.title': 'Достань косяки дизайна из интервью, получив <span class="highlight">CJM с инсайтами</span>',
    'hero.subtitle': 'Загрузи транскрипт интервью одного или нескольких пользователей, а через минуту получи инсайты по дизайну',
    'hero.cta.install': 'Скачать плагин',
    'hero.cta.start': 'Как начать',
    'hero.img.label': 'Скриншот: готовая CJM в Figma',
    'hero.img.desc': 'Полная карта пути пользователя с этапами, действиями, touchpoints, мыслями, эмоциями, цитатами, метриками и гипотезами. Показать со всеми включёнными секциями.',

    'story.problem1': 'Строить CJM вручную — долго. Хочется тратить время на идеи, а не на раскраску ячеек.',
    'story.problem2': 'Транскрипты лежат в файлах. Таблицы — в Excel или Google. Карту собирают по крупицам.',
    'story.problem3': 'А если транскрипт или таблица превращались в готовую карту за минуту?',
    'story.whatif': 'Один клик — и CJM уже в Figma, с этапами, экранами и инсайтами.',

    'features.label': 'Возможности',
    'features.title': 'Всё, что нужно для CJM —<br>в одном плагине',
    'features.subtitle': 'Один плагин. Минута вместо часов.',
    'features.transcripts.title': 'Транскрипты интервью',
    'features.transcripts.desc': 'Сэкономить 2–3 часа. Загрузите .txt — AI извлечёт этапы, действия, мысли, эмоции и цитаты.',
    'features.excel.title': 'Таблицы Excel и CSV',
    'features.excel.desc': 'Показать, что готовая таблица — уже CJM. Плагин распознает структуру и рисует карту. AI справится с «грязными» данными.',
    'features.gsheets.title': 'Google Таблицы',
    'features.gsheets.desc': 'Вставьте ссылку — плагин сам подтянет данные и построит карту. Без копирования в Excel.',
    'features.aggregation.title': 'Агрегация нескольких интервью',
    'features.aggregation.desc': 'Объединить 5–10 интервью в одну CJM с Job Stories. AI сам находит общие паттерны.',
    'features.screens.title': 'Привязка экранов из Figma',
    'features.screens.desc': 'Выделите фреймы — ссылки или превью под каждым этапом. Экран и этап связаны автоматически.',
    'features.vision.title': 'Vision-аннотации',
    'features.vision.desc': 'AI ставит аннотации и стрелки прямо на макеты. Увидите, где пользователь путается или радуется.',
    'features.jobstory.title': 'Job Story (JTBD)',
    'features.jobstory.desc': 'AI вытягивает «When… I want to… So I can…» из транскрипта. Без ручной расшифровки.',
    'features.analytics.title': 'Продуктовая аналитика',
    'features.analytics.desc': 'Жизненный цикл, ABCDX, активация, вовлечённость — один чекбокс, и слой на карте.',
    'features.prompts.title': 'Настраиваемые промпты',
    'features.prompts.desc': 'Подстроить AI под продукт. Редактируйте промпты — меняйте логику извлечения.',

    'modes.label': 'Режимы экранов',
    'modes.title': 'Три способа показать экраны на CJM',
    'modes.subtitle': 'Выберите, как связать дизайн-макеты с этапами пути пользователя — от простых ссылок до AI-аннотаций поверх скриншотов.',
    'modes.links.img.label': 'Скриншот: CJM со ссылками',
    'modes.links.img.desc': 'CJM, где под каждым этапом — кликабельные ссылки на фреймы в Figma. Без картинок, компактный вид.',
    'modes.links.tag': 'Ссылки',
    'modes.links.title': 'Ссылки на фреймы',
    'modes.links.desc': 'Под каждым этапом — кликабельные ссылки на оригинальные фреймы в Figma. Лёгкий и компактный вариант.',
    'modes.png.img.label': 'Скриншот: CJM с PNG-превью',
    'modes.png.img.desc': 'CJM с маленькими скриншотами экранов под каждым этапом. AI сопоставляет экраны с этапами по смыслу.',
    'modes.png.tag': 'Превью (PNG)',
    'modes.png.title': 'PNG-превью + AI-сопоставление',
    'modes.png.desc': 'AI анализирует названия фреймов и этапов, сопоставляет их по смыслу. Под каждым этапом — масштабированные скриншоты экранов.',
    'modes.vision.img.label': 'Скриншот: CJM с Vision-аннотациями',
    'modes.vision.img.desc': 'Экраны с цветными карточками аннотаций слева и стрелками, указывающими на конкретные элементы интерфейса.',
    'modes.vision.tag': 'Vision-аннотации',
    'modes.vision.title': 'AI-комментарии на макетах',
    'modes.vision.desc': 'GPT-4o Vision смотрит на каждый экран + транскрипт и расставляет аннотации со стрелками к конкретным элементам интерфейса.',

    'settings.label': 'Интерфейс плагина',
    'settings.title': 'Простые настройки,<br>мощный результат',
    'settings.subtitle': 'Две вкладки: «Создание» для запуска генерации и «Промпты» для тонкой настройки поведения AI.',
    'settings.tab1.label': 'Вкладка «Создание»',
    'settings.tab1.title': 'Загрузите данные и выберите настройки',
    'settings.tab1.desc': 'Выберите источник — файл (xlsx, csv, txt, md) или Google Таблица. Укажите, откуда брать экраны и в каком режиме их показывать.',
    'settings.tab1.li1': 'Автоматическое определение типа файла (таблица или транскрипт)',
    'settings.tab1.li2': 'Несколько файлов .txt/.md → агрегированная CJM',
    'settings.tab1.li3': 'Экраны: из выделения, из Section или со страницы',
    'settings.tab1.li4': 'Режим экранов: ссылки или PNG-превью',
    'settings.tab1.li5': 'AI-сопоставление экранов с этапами по смыслу',
    'settings.tab1.li6': 'Vision-аннотации на скриншотах (GPT-4o)',
    'settings.tab1.li7': 'Кнопка «Отменить» для остановки генерации',
    'settings.tab1.img.label': 'Скриншот: вкладка «Создание»',
    'settings.tab1.img.desc': 'Интерфейс плагина с загрузкой файла, выбором источника экранов, режимом PNG + чекбоксы AI-сопоставления и Vision.',
    'settings.tab2.label': 'Вкладка «Промпты»',
    'settings.tab2.title': 'Полный контроль над логикой AI',
    'settings.tab2.desc': 'Все системные промпты редактируемы. Включайте и отключайте дополнительные слои анализа чекбоксами.',
    'settings.tab2.li1': 'Промпт для транскриптов — что извлекать из интервью',
    'settings.tab2.li2': 'Промпт для Job Story (JTBD фреймворк)',
    'settings.tab2.li3': 'Промпт для агрегации нескольких интервью',
    'settings.tab2.li4': 'Опции: длительность этапов, каналы и переходы',
    'settings.tab2.li5': 'Продуктовая аналитика: жизненный цикл, ABCDX-сегмент',
    'settings.tab2.li6': 'Активация, вовлечённость, adoption',
    'settings.tab2.li7': 'Метрики продукта и инсайты',
    'settings.tab2.li8': 'Промпт для сопоставления экранов и Vision-аннотаций',
    'settings.tab2.img.label': 'Скриншот: вкладка «Промпты»',
    'settings.tab2.img.desc': 'Чекбоксы продуктовой аналитики, текстовые поля системных промптов для настройки логики анализа AI.',

    'start.label': 'Начало работы',
    'start.title': 'Четыре шага до готовой CJM',
    'start.step1.title': 'Получите API-ключ',
    'start.step1.desc': 'Зарегистрируйтесь на <a href="https://platform.openai.com" target="_blank">platform.openai.com</a>, пополните баланс на $2–5 и создайте API-ключ.',
    'start.step2.title': 'Установите плагин',
    'start.step2.desc': 'Найдите «Сборка CJM» в Figma Community и нажмите Install. Плагин появится в меню Plugins.',
    'start.step3.title': 'Загрузите данные',
    'start.step3.desc': 'Транскрипт интервью (.txt, .md), таблицу (.xlsx, .csv) или ссылку на Google Таблицу. Выделите фреймы для привязки экранов.',
    'start.step4.title': 'Получите CJM',
    'start.step4.desc': 'Нажмите «Создать CJM» — через 30–60 секунд готовая карта появится на канвасе Figma.',
    'start.callout.title': 'Про API-ключ и стоимость',
    'start.callout.desc': 'Плагин <strong>бесплатный</strong>. Для работы AI вам нужен собственный API-ключ OpenAI. Одна генерация CJM из транскрипта стоит примерно <code>$0.02–0.05</code> (GPT-4o-mini). Vision-аннотации используют GPT-4o — около <code>$0.01–0.02</code> за экран. Пополнения на <strong>$2–5</strong> хватит на десятки генераций.',

    'examples.label': 'Примеры',
    'examples.title': 'Как выглядит результат',
    'examples.subtitle': 'Ниже — примеры CJM, сгенерированных плагином из реальных транскриптов интервью с различными настройками.',
    'examples.ex1.img.label': 'Скриншот: базовая CJM',
    'examples.ex1.img.desc': 'CJM из одного транскрипта: этапы, действия, touchpoints, опыт, мысли, эмоции, цитаты, метрики и гипотезы. Без экранов и без продуктовой аналитики.',
    'examples.ex1.title': 'Базовая CJM из транскрипта',
    'examples.ex1.desc': 'Один транскрипт интервью → полная карта пути с этапами, действиями, touchpoints, мыслями, эмоциями, цитатами, метриками и гипотезами. Job Story в шапке.',
    'examples.ex2.img.label': 'Скриншот: CJM с продуктовой аналитикой',
    'examples.ex2.img.desc': 'CJM с блоком Product Analytics: lifecycle, сегмент (ABCDX), точка активации, вовлечённость, adoption, product insights.',
    'examples.ex2.title': 'CJM с продуктовой аналитикой',
    'examples.ex2.desc': 'Включите чекбоксы продуктовой аналитики — AI определит этап жизненного цикла, ABCDX-сегмент, точку активации и предложит продуктовые инсайты.',
    'examples.ex3.img.label': 'Скриншот: сценарий с экранами',
    'examples.ex3.img.desc': 'CJM в режиме «Превью (PNG)» + AI-сопоставление: экраны распределены по этапам с аннотациями. Без Vision.',
    'examples.ex3.title': 'Сценарий с PNG-экранами',
    'examples.ex3.desc': 'Выделите фреймы или секцию, выберите «Превью (PNG)» и включите AI-сопоставление — экраны автоматически распределятся по этапам CJM с текстовыми аннотациями.',
    'examples.ex4.img.label': 'Скриншот: Vision-аннотации крупным планом',
    'examples.ex4.img.desc': 'Экраны с цветными карточками слева: «Ценность», «Боль», «Разочарование» и т.д. Стрелки от карточек к конкретным элементам на скриншоте. Цветные точки на экране.',
    'examples.ex4.title': 'Vision-аннотации на экранах',
    'examples.ex4.desc': 'GPT-4o Vision анализирует каждый PNG-скриншот вместе с транскриптом и контекстом этапа. Результат — карточки с комментариями слева от экрана и стрелки к конкретным элементам интерфейса.',

    'footer.text': 'Сборка CJM — бесплатный Figma-плагин. Работает на OpenAI API.'
  },

  en: {
    'nav.logo': 'CJM Builder',
    'nav.features': 'Features',
    'nav.modes': 'Modes',
    'nav.settings': 'Settings',
    'nav.start': 'Get started',
    'nav.donate': 'Donate',
    'nav.download': 'Download',

    'hero.badge': 'Free Figma plugin',
    'hero.title': 'Get design flaws from interviews and build <span class="highlight">CJM with insights</span>',
    'hero.subtitle': 'Upload one or more user interview transcripts — get design insights in a minute',
    'hero.cta.install': 'Download plugin',
    'hero.cta.start': 'Get started',
    'hero.img.label': 'Screenshot: ready CJM in Figma',
    'hero.img.desc': 'Full user journey map with stages, actions, touchpoints, thoughts, emotions, quotes, metrics and hypotheses. Shown with all sections enabled.',

    'story.problem1': 'Building CJM by hand takes time. You want to spend hours on ideas, not coloring cells.',
    'story.problem2': 'Transcripts sit in files. Tables live in Excel or Google. You stitch the map together piece by piece.',
    'story.problem3': 'What if a transcript or table turned into a ready map in a minute?',
    'story.whatif': 'One click — and the CJM is in Figma, with stages, screens and insights.',

    'features.label': 'Features',
    'features.title': 'Everything you need for CJM —<br>in one plugin',
    'features.subtitle': 'One plugin. One minute instead of hours.',
    'features.transcripts.title': 'Interview transcripts',
    'features.transcripts.desc': 'Save 2–3 hours. Upload .txt — AI extracts stages, actions, thoughts, emotions and quotes.',
    'features.excel.title': 'Excel & CSV tables',
    'features.excel.desc': 'Show that a ready table is already a CJM. The plugin reads structure and draws the map. AI handles messy data.',
    'features.gsheets.title': 'Google Sheets',
    'features.gsheets.desc': 'Paste a link — the plugin pulls data and builds the map. No copy-paste to Excel.',
    'features.aggregation.title': 'Multiple interview aggregation',
    'features.aggregation.desc': 'Merge 5–10 interviews into one CJM with Job Stories. AI finds common patterns.',
    'features.screens.title': 'Figma screen linking',
    'features.screens.desc': 'Select frames — links or previews appear under each stage. Screen and stage linked automatically.',
    'features.vision.title': 'Vision annotations',
    'features.vision.desc': 'AI places annotations and arrows on mockups. See where users get confused or delighted.',
    'features.jobstory.title': 'Job Story (JTBD)',
    'features.jobstory.desc': 'AI pulls "When… I want to… So I can…" from the transcript. No manual decoding.',
    'features.analytics.title': 'Product analytics',
    'features.analytics.desc': 'Lifecycle, ABCDX, activation, engagement — one checkbox and the layer appears on the map.',
    'features.prompts.title': 'Customizable prompts',
    'features.prompts.desc': 'Tune AI for your product. Edit prompts — change the extraction logic.',

    'modes.label': 'Screen modes',
    'modes.title': 'Three ways to display screens on CJM',
    'modes.subtitle': 'Choose how to link design mockups with user journey stages — from simple links to AI annotations over screenshots.',
    'modes.links.img.label': 'Screenshot: CJM with links',
    'modes.links.img.desc': 'CJM with clickable links to Figma frames under each stage. No images, compact view.',
    'modes.links.tag': 'Links',
    'modes.links.title': 'Frame links',
    'modes.links.desc': 'Under each stage — clickable links to original Figma frames. Lightweight and compact option.',
    'modes.png.img.label': 'Screenshot: CJM with PNG previews',
    'modes.png.img.desc': 'CJM with small screen screenshots under each stage. AI matches screens to stages by meaning.',
    'modes.png.tag': 'Preview (PNG)',
    'modes.png.title': 'PNG preview + AI matching',
    'modes.png.desc': 'AI analyzes frame and stage names, matching them by meaning. Under each stage — scaled screen screenshots.',
    'modes.vision.img.label': 'Screenshot: CJM with Vision annotations',
    'modes.vision.img.desc': 'Screens with colored annotation cards on the left and arrows pointing to specific interface elements.',
    'modes.vision.tag': 'Vision annotations',
    'modes.vision.title': 'AI comments on mockups',
    'modes.vision.desc': 'GPT-4o Vision looks at each screen + transcript and places annotations with arrows to specific interface elements.',

    'settings.label': 'Plugin interface',
    'settings.title': 'Simple settings,<br>powerful results',
    'settings.subtitle': 'Two tabs: "Create" to launch generation and "Prompts" for fine-tuning AI behavior.',
    'settings.tab1.label': '"Create" tab',
    'settings.tab1.title': 'Upload data and choose settings',
    'settings.tab1.desc': 'Choose a source — file (xlsx, csv, txt, md) or Google Sheet. Specify where to get screens and which mode to display them.',
    'settings.tab1.li1': 'Automatic file type detection (table or transcript)',
    'settings.tab1.li2': 'Multiple .txt/.md files → aggregated CJM',
    'settings.tab1.li3': 'Screens: from selection, Section, or page',
    'settings.tab1.li4': 'Screen mode: links or PNG preview',
    'settings.tab1.li5': 'AI matching of screens to stages by meaning',
    'settings.tab1.li6': 'Vision annotations on screenshots (GPT-4o)',
    'settings.tab1.li7': '"Cancel" button to stop generation',
    'settings.tab1.img.label': 'Screenshot: "Create" tab',
    'settings.tab1.img.desc': 'Plugin UI with file upload, screen source selection, PNG mode + AI matching and Vision checkboxes.',
    'settings.tab2.label': '"Prompts" tab',
    'settings.tab2.title': 'Full control over AI logic',
    'settings.tab2.desc': 'All system prompts are editable. Enable and disable additional analysis layers with checkboxes.',
    'settings.tab2.li1': 'Transcript prompt — what to extract from interviews',
    'settings.tab2.li2': 'Job Story prompt (JTBD framework)',
    'settings.tab2.li3': 'Aggregation prompt for multiple interviews',
    'settings.tab2.li4': 'Options: stage duration, channels and transitions',
    'settings.tab2.li5': 'Product analytics: lifecycle, ABCDX segment',
    'settings.tab2.li6': 'Activation, engagement, adoption',
    'settings.tab2.li7': 'Product metrics and insights',
    'settings.tab2.li8': 'Prompt for screen matching and Vision annotations',
    'settings.tab2.img.label': 'Screenshot: "Prompts" tab',
    'settings.tab2.img.desc': 'Product analytics checkboxes, text fields for system prompts to configure AI analysis logic.',

    'start.label': 'Getting started',
    'start.title': 'Four steps to a ready CJM',
    'start.step1.title': 'Get an API key',
    'start.step1.desc': 'Sign up at <a href="https://platform.openai.com" target="_blank">platform.openai.com</a>, add $2–5 to your balance and create an API key.',
    'start.step2.title': 'Install the plugin',
    'start.step2.desc': 'Find "CJM Builder" in Figma Community and click Install. The plugin will appear in the Plugins menu.',
    'start.step3.title': 'Upload data',
    'start.step3.desc': 'An interview transcript (.txt, .md), a table (.xlsx, .csv) or a Google Sheet link. Select frames for screen linking.',
    'start.step4.title': 'Get your CJM',
    'start.step4.desc': 'Click "Create CJM" — in 30–60 seconds a ready map will appear on the Figma canvas.',
    'start.callout.title': 'About the API key and cost',
    'start.callout.desc': 'The plugin is <strong>free</strong>. For AI to work you need your own OpenAI API key. One CJM generation from a transcript costs about <code>$0.02–0.05</code> (GPT-4o-mini). Vision annotations use GPT-4o — about <code>$0.01–0.02</code> per screen. A top-up of <strong>$2–5</strong> is enough for dozens of generations.',

    'examples.label': 'Examples',
    'examples.title': 'What the result looks like',
    'examples.subtitle': 'Below are CJM examples generated by the plugin from real interview transcripts with various settings.',
    'examples.ex1.img.label': 'Screenshot: basic CJM',
    'examples.ex1.img.desc': 'CJM from one transcript: stages, actions, touchpoints, experience, thoughts, emotions, quotes, metrics and hypotheses. No screens, no product analytics.',
    'examples.ex1.title': 'Basic CJM from transcript',
    'examples.ex1.desc': 'One interview transcript → full journey map with stages, actions, touchpoints, thoughts, emotions, quotes, metrics and hypotheses. Job Story in the header.',
    'examples.ex2.img.label': 'Screenshot: CJM with product analytics',
    'examples.ex2.img.desc': 'CJM with Product Analytics block: lifecycle, segment (ABCDX), activation point, engagement, adoption, product insights.',
    'examples.ex2.title': 'CJM with product analytics',
    'examples.ex2.desc': 'Enable product analytics checkboxes — AI will identify lifecycle stage, ABCDX segment, activation point and suggest product insights.',
    'examples.ex3.img.label': 'Screenshot: scenario with screens',
    'examples.ex3.img.desc': 'CJM in "Preview (PNG)" mode + AI matching: screens distributed across stages with annotations. No Vision.',
    'examples.ex3.title': 'Scenario with PNG screens',
    'examples.ex3.desc': 'Select frames or a section, choose "Preview (PNG)" and enable AI matching — screens will automatically be distributed across CJM stages with text annotations.',
    'examples.ex4.img.label': 'Screenshot: Vision annotations close-up',
    'examples.ex4.img.desc': 'Screens with colored cards on the left: "Value", "Pain", "Frustration" etc. Arrows from cards to specific elements on the screenshot. Colored dots on the screen.',
    'examples.ex4.title': 'Vision annotations on screens',
    'examples.ex4.desc': 'GPT-4o Vision analyzes each PNG screenshot together with the transcript and stage context. The result — comment cards to the left of the screen and arrows to specific interface elements.',

    'footer.text': 'CJM Builder — free Figma plugin. Powered by OpenAI API.'
  }
};

var currentLang = 'ru';

function applyLanguage(lang) {
  var strings = I18N[lang];
  if (!strings) return;
  currentLang = lang;

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    if (strings[key] !== undefined) {
      el.textContent = strings[key];
    }
  });

  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-html');
    if (strings[key] !== undefined) {
      el.innerHTML = strings[key];
    }
  });

  document.documentElement.lang = lang === 'ru' ? 'ru' : 'en';

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  updatePluginImages(lang);

  try { localStorage.setItem('cjm-lang', lang); } catch (e) {}
}

function updatePluginImages(lang) {
  document.querySelectorAll('.img-plugin').forEach(function (btn) {
    var src = btn.getAttribute('data-src-' + lang);
    var srcset = btn.getAttribute('data-srcset-' + lang);
    var img = btn.querySelector('img');
    if (img && src) {
      img.src = src;
      img.srcset = srcset || '';
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var nav = document.querySelector('.nav');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 80) {
      nav.style.boxShadow = '0 1px 8px rgba(0,0,0,0.04)';
    } else {
      nav.style.boxShadow = 'none';
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLanguage(this.getAttribute('data-lang'));
    });
  });

  var saved = 'ru';
  try { saved = localStorage.getItem('cjm-lang') || 'ru'; } catch (e) {}
  applyLanguage(saved);

  if (typeof lucide !== 'undefined') lucide.createIcons();

  var modal = document.getElementById('img-modal');
  var modalImg = modal && modal.querySelector('.img-modal-img');

  function openModal(src, srcset) {
    if (!modal || !modalImg) return;
    modalImg.src = src;
    modalImg.srcset = srcset || '';
    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.img-preview-trigger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src, srcset;
      if (this.classList.contains('img-plugin')) {
        src = this.getAttribute('data-src-' + currentLang);
        srcset = this.getAttribute('data-srcset-' + currentLang);
      } else {
        src = this.getAttribute('data-src');
        srcset = this.getAttribute('data-srcset');
      }
      if (src) openModal(src, srcset);
    });
  });

  if (modal) {
    modal.querySelector('.img-modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.img-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }
});
