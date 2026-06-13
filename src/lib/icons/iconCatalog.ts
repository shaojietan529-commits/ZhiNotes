// Emoji icon library for page icons. Grouped into categories so the picker
// can show tabs, and every entry carries keywords (English + 中文) so search
// works in either language. This is a static, local-only catalog — no network.

export interface IconCategory {
  id: string;
  label: string;
  icons: string[];
}

// Keyword index for search. Only a curated subset needs keywords; the rest are
// still findable by their own glyph. Keys are emoji, values are search terms.
export const ICON_KEYWORDS: Record<string, string> = {
  "📄": "page document file 页面 文档 文件",
  "📝": "note memo write 笔记 备忘 记录",
  "📋": "clipboard list 清单 列表",
  "📊": "chart bar data 图表 柱状 数据",
  "📈": "chart up growth 增长 上涨 图表",
  "📉": "chart down decline 下跌 下滑 图表",
  "💰": "money bag fund 资金 钱袋 基金",
  "💵": "cash dollar 现金 美元 钱",
  "💹": "yen chart market 行情 市场 涨",
  "🏦": "bank 银行 金融",
  "🏢": "company office building 公司 办公 大楼",
  "🏭": "factory industry manufacturing 工厂 制造 产业",
  "🔬": "research lab science 研究 实验 科学",
  "💡": "idea insight 想法 灵感 点子",
  "🎯": "target goal 目标 靶心",
  "🚀": "rocket launch growth 火箭 发射 增长",
  "🔥": "hot fire trending 热门 火热",
  "💎": "diamond value gem 钻石 价值 珍贵",
  "🏆": "trophy win best 奖杯 第一 最佳",
  "📅": "calendar date 日历 日期",
  "⏰": "clock time alarm 时钟 时间 闹钟",
  "✅": "check done complete 完成 对勾 通过",
  "⚠️": "warning risk caution 警告 风险 注意",
  "🔒": "lock secure private 锁 安全 私密",
  "🧠": "brain think idea 大脑 思考 思路",
  "📚": "books library knowledge 书 知识库 资料",
  "💼": "briefcase work portfolio 公文包 工作 组合",
  "🔍": "search find magnify 搜索 查找 放大",
  "👤": "person user profile 个人 用户 人物",
  "👥": "people team group 团队 群组 多人",
  "🤝": "deal handshake meeting 合作 握手 会议",
  "🌐": "globe web internet 全球 网络 互联网",
  "🔗": "link chain url 链接 关联",
  "🚗": "car auto vehicle 汽车 整车",
  "🔋": "battery energy power 电池 能源 动力",
  "💊": "pharma medicine drug 医药 药品 制药",
  "🛢️": "oil energy crude 石油 原油 能源",
  "⚡": "power electricity energy 电力 电 能源",
  "🌾": "agriculture grain food 农业 粮食 农产品",
  "🏗️": "construction infra build 基建 建筑 施工",
  "✈️": "airline travel aviation 航空 旅行 飞机",
  "🛒": "retail consumer shopping 零售 消费 购物",
  "📱": "phone mobile tech 手机 移动 科技",
  "💻": "computer tech software 电脑 软件 科技",
  "🪙": "coin crypto token 代币 加密 硬币",
  "🏠": "home house real-estate 房产 地产 家",
};

export const ICON_CATEGORIES: IconCategory[] = [
  {
    id: "research",
    label: "投研",
    icons: [
      "📄", "📝", "📋", "📑", "📌", "📎", "🔬", "🔭", "💡", "🧠",
      "🎯", "🔍", "🔎", "📐", "✏️", "🖊️", "📖", "📚", "🗂️", "🗃️",
    ],
  },
  {
    id: "finance",
    label: "金融",
    icons: [
      "💰", "💵", "💴", "💶", "💷", "💹", "📊", "📈", "📉", "🏦",
      "🪙", "💳", "🧾", "💼", "🏆", "💎", "⚖️", "📒", "📔", "🧮",
    ],
  },
  {
    id: "industry",
    label: "产业",
    icons: [
      "🏢", "🏭", "🏗️", "🚗", "✈️", "🚢", "🚂", "🔋", "⚡", "🛢️",
      "💊", "🌾", "🛒", "📱", "💻", "🖥️", "🛰️", "🔌", "⚙️", "🧪",
    ],
  },
  {
    id: "status",
    label: "状态",
    icons: [
      "✅", "❌", "⚠️", "❓", "❗", "⭐", "🔥", "🚀", "🔔", "🔒",
      "🔓", "📍", "🚩", "🏁", "⏳", "⏰", "📅", "🗓️", "📆", "🕐",
    ],
  },
  {
    id: "people",
    label: "人物",
    icons: [
      "👤", "👥", "🤝", "🧑‍💼", "👔", "🗣️", "💬", "📞", "📧", "✉️",
      "🙂", "🤔", "👀", "👍", "👏", "🙌", "✍️", "🧑‍🔬", "🧑‍💻", "🦉",
    ],
  },
  {
    id: "objects",
    label: "通用",
    icons: [
      "📁", "📂", "📦", "🗄️", "🗒️", "🌐", "🔗", "🏠", "🌍", "🧭",
      "🗺️", "🎨", "🎵", "📷", "🎬", "🍀", "🌱", "🌟", "🪐", "🧩",
    ],
  },
];

// Flat list of every catalogued icon (for search across all categories).
export const ALL_ICONS: string[] = Array.from(
  new Set(ICON_CATEGORIES.flatMap((category) => category.icons))
);

// Search an icon by keyword (matches the glyph itself or its keyword string).
export function searchIcons(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ALL_ICONS;
  return ALL_ICONS.filter((icon) => {
    if (icon.includes(normalized)) return true;
    const keywords = ICON_KEYWORDS[icon];
    return keywords ? keywords.toLowerCase().includes(normalized) : false;
  });
}
