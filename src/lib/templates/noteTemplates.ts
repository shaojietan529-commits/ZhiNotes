export interface NoteTemplate {
  title: string;
  description: string;
  aliases: string[];
  html: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    title: "投资备忘录",
    description: "投资假设、估值、风险和下一步",
    aliases: [
      "Investment Memo",
      "investment",
      "memo",
      "thesis",
      "stock",
      "投资",
      "备忘录",
    ],
    html: `
      <h1>投资备忘录</h1>
      <h2>一句话投资假设</h2>
      <p></p>
      <h2>业务快照</h2>
      <ul>
        <li>公司：</li>
        <li>行业：</li>
        <li>收入驱动：</li>
        <li>核心壁垒：</li>
      </ul>
      <h2>为什么是现在</h2>
      <p></p>
      <h2>估值</h2>
      <table>
        <tbody>
          <tr><th>指标</th><th>基准情景</th><th>乐观情景</th><th>悲观情景</th></tr>
          <tr><td>收入增长</td><td></td><td></td><td></td></tr>
          <tr><td>利润率</td><td></td><td></td><td></td></tr>
          <tr><td>倍数 / DCF</td><td></td><td></td><td></td></tr>
          <tr><td>隐含上行空间</td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>关键假设</h2>
      <ul>
        <li>收入增长：</li>
        <li>利润率路径：</li>
        <li>资本开支强度：</li>
        <li>终值倍数 / 折现率：</li>
      </ul>
      <h2>风险</h2>
      <ul>
        <li></li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>最新报告：</li>
        <li>相关会议：</li>
      </ul>
      <h2>决策</h2>
      <p></p>
    `,
  },
  {
    title: "持仓备忘录",
    description: "组合想法、仓位纪律、确信度和风险复盘",
    aliases: [
      "Position Memo",
      "position memo",
      "portfolio memo",
      "holding memo",
      "position size",
      "持仓",
      "持仓备忘录",
      "仓位",
      "组合",
    ],
    html: `
      <h1>持仓备忘录</h1>
      <h2>一句话投资假设</h2>
      <p></p>
      <h2>组合角色</h2>
      <ul>
        <li>角色：</li>
        <li>研究状态：</li>
        <li>确信度：</li>
        <li>下次复盘日期：</li>
      </ul>
      <h2>仓位纪律</h2>
      <table>
        <tbody>
          <tr><th>项目</th><th>当前判断</th><th>触发条件</th><th>复盘频率</th></tr>
          <tr><td>目标权重</td><td></td><td></td><td></td></tr>
          <tr><td>当前权重</td><td></td><td></td><td></td></tr>
          <tr><td>上行情景</td><td></td><td></td><td></td></tr>
          <tr><td>下行情景</td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>关键催化剂</h2>
      <ul>
        <li>下一催化剂：</li>
        <li>需要提前验证的信号：</li>
        <li>复盘窗口：</li>
      </ul>
      <h2>风险笔记</h2>
      <ul>
        <li>核心风险：</li>
        <li>反向证据：</li>
        <li>降权或退出条件：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>投资备忘录：</li>
        <li>相关报告：</li>
        <li>相关会议：</li>
      </ul>
      <h2>后续行动</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>补充研究 relation</p></div></li>
      </ul>
    `,
  },
  {
    title: "观察名单",
    description: "待研究公司、优先级、触发条件和下一步",
    aliases: [
      "Watchlist",
      "watchlist",
      "idea list",
      "idea",
      "pipeline",
      "观察名单",
      "想法",
      "待研究",
      "研究队列",
    ],
    html: `
      <h1>观察名单</h1>
      <h2>想法来源</h2>
      <ul>
        <li>来源：</li>
        <li>初始日期：</li>
        <li>优先级：</li>
        <li>下一步负责人：</li>
      </ul>
      <h2>进入正式研究的触发条件</h2>
      <ul>
        <li>估值进入可研究区间：</li>
        <li>基本面变化：</li>
        <li>催化剂临近：</li>
        <li>信息缺口补齐：</li>
      </ul>
      <h2>初步投资假设</h2>
      <p></p>
      <h2>需要验证的问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>商业模式和行业结构</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>关键指标和单位经济</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>估值假设和风险笔记</p></div></li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>相关报告：</li>
        <li>相关会议：</li>
        <li>持仓备忘录：</li>
      </ul>
    `,
  },
  {
    title: "催化剂与风险复盘",
    description: "事件检查点、反向证据、风险监控和复盘结论",
    aliases: [
      "Catalyst Risk Review",
      "catalyst",
      "risk review",
      "risk notes",
      "review",
      "催化剂",
      "风险复盘",
      "风险笔记",
      "检查点",
    ],
    html: `
      <h1>催化剂与风险复盘</h1>
      <h2>关联研究</h2>
      <ul>
        <li>持仓备忘录：</li>
        <li>公司页面：</li>
        <li>相关报告：</li>
        <li>相关会议：</li>
      </ul>
      <h2>催化剂</h2>
      <table>
        <tbody>
          <tr><th>事件</th><th>预期影响</th><th>检查日期</th><th>复盘结论</th></tr>
          <tr><td>下一催化剂</td><td></td><td></td><td></td></tr>
          <tr><td>业绩披露</td><td></td><td></td><td></td></tr>
          <tr><td>管理层会议</td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>风险监控</h2>
      <ul>
        <li>核心风险：</li>
        <li>反向证据：</li>
        <li>需要降低确信度的信号：</li>
      </ul>
      <h2>投资假设变化</h2>
      <ul>
        <li>增强的假设：</li>
        <li>削弱的假设：</li>
        <li>需要等待下一次验证的假设：</li>
      </ul>
      <h2>后续行动</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>更新持仓备忘录</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>补充相关报告或会议 relation</p></div></li>
      </ul>
    `,
  },
  {
    title: "业绩复盘",
    description: "季度业绩、管理层表述和模型影响",
    aliases: [
      "Earnings Review",
      "earnings",
      "quarter",
      "results",
      "call",
      "业绩",
      "财报",
    ],
    html: `
      <h1>业绩复盘</h1>
      <h2>核心结论</h2>
      <p></p>
      <h2>关键数据</h2>
      <table>
        <tbody>
          <tr><th>项目</th><th>实际</th><th>预期</th><th>上期</th><th>备注</th></tr>
          <tr><td>收入</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>毛利率</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>经营利润率</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>EPS</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>指引</td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>发生了什么变化</h2>
      <ul>
        <li></li>
      </ul>
      <h2>管理层表述</h2>
      <blockquote></blockquote>
      <h2>模型影响</h2>
      <p></p>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>上一版 memo：</li>
        <li>相关会议：</li>
        <li>最新报告：</li>
      </ul>
      <h2>后续问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
    `,
  },
  {
    title: "公司研究",
    description: "结构化公司深度研究",
    aliases: [
      "Company Research",
      "company",
      "research",
      "deep dive",
      "profile",
      "公司",
      "研究",
    ],
    html: `
      <h1>公司研究</h1>
      <h2>摘要</h2>
      <p></p>
      <h2>商业模式</h2>
      <p></p>
      <h2>行业结构</h2>
      <ul>
        <li>市场规模：</li>
        <li>增长率：</li>
        <li>竞争强度：</li>
        <li>监管因素：</li>
      </ul>
      <h2>单位经济模型</h2>
      <table>
        <tbody>
          <tr><th>驱动因素</th><th>观察</th><th>证据</th></tr>
          <tr><td>定价权</td><td></td><td></td></tr>
          <tr><td>客户留存</td><td></td><td></td></tr>
          <tr><td>经营杠杆</td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>估值假设</h2>
      <table>
        <tbody>
          <tr><th>假设</th><th>基准</th><th>上行情景</th><th>下行情景</th></tr>
          <tr><td>收入 CAGR</td><td></td><td></td><td></td></tr>
          <tr><td>经营利润率</td><td></td><td></td><td></td></tr>
          <tr><td>自由现金流转化率</td><td></td><td></td><td></td></tr>
          <tr><td>退出倍数</td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>报告与会议</h2>
      <ul>
        <li>最新报告：</li>
        <li>管理层会议：</li>
        <li>专家电话会：</li>
        <li>业绩复盘：</li>
      </ul>
      <h2>待解决问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
    `,
  },
  {
    title: "估值假设",
    description: "收入、利润率、倍数和情景假设",
    aliases: [
      "Valuation Assumptions",
      "valuation",
      "assumptions",
      "target price",
      "scenario",
      "估值",
      "估值假设",
      "目标价",
      "情景",
    ],
    html: `
      <h1>估值假设</h1>
      <h2>关联公司</h2>
      <ul>
        <li>公司页面：</li>
        <li>Ticker：</li>
        <li>当前覆盖状态：</li>
        <li>最新 memo：</li>
      </ul>
      <h2>核心估值结论</h2>
      <p></p>
      <h2>情景假设</h2>
      <table>
        <tbody>
          <tr><th>项目</th><th>下行情景</th><th>基准情景</th><th>上行情景</th><th>证据 / 备注</th></tr>
          <tr><td>收入 CAGR</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>毛利率</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>经营利润率</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>自由现金流转化率</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>退出倍数 / 折现率</td><td></td><td></td><td></td><td></td></tr>
          <tr><td>隐含目标价</td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>关键敏感性</h2>
      <ul>
        <li>收入增长：</li>
        <li>利润率路径：</li>
        <li>资本开支 / working capital：</li>
        <li>倍数或折现率：</li>
      </ul>
      <h2>需要验证的问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>相关报告：</li>
        <li>相关会议：</li>
        <li>业绩复盘：</li>
      </ul>
    `,
  },
  {
    title: "关键指标看板",
    description: "KPI、单位经济和运营指标追踪",
    aliases: [
      "Key Metrics",
      "metrics dashboard",
      "kpi",
      "unit economics",
      "operating metrics",
      "关键指标",
      "指标看板",
      "单位经济",
      "运营指标",
    ],
    html: `
      <h1>关键指标看板</h1>
      <h2>关联公司</h2>
      <ul>
        <li>公司页面：</li>
        <li>Ticker：</li>
        <li>行业 / 业务线：</li>
        <li>最新业绩复盘：</li>
      </ul>
      <h2>核心 KPI</h2>
      <table>
        <tbody>
          <tr><th>指标</th><th>当前值</th><th>上期</th><th>同比 / 环比</th><th>为什么重要</th><th>来源</th></tr>
          <tr><td>收入增长</td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td>毛利率</td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td>经营利润率</td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td>留存 / churn</td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td>单位经济</td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>趋势判断</h2>
      <ul>
        <li>改善中的指标：</li>
        <li>恶化中的指标：</li>
        <li>需要等待下一次披露的指标：</li>
      </ul>
      <h2>投研影响</h2>
      <ul>
        <li>对投资假设的影响：</li>
        <li>对估值假设的影响：</li>
        <li>对后续问题的影响：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>相关报告：</li>
        <li>相关会议：</li>
        <li>估值假设：</li>
      </ul>
    `,
  },
  {
    title: "会议纪要",
    description: "会议记录、讨论要点和行动项",
    aliases: [
      "Meeting Notes",
      "meeting",
      "notes",
      "call",
      "action",
      "会议",
      "纪要",
    ],
    html: `
      <h1>会议纪要</h1>
      <h2>会议信息</h2>
      <ul>
        <li>主题：</li>
        <li>组织者：</li>
        <li>平台：</li>
        <li>会议链接：</li>
        <li>日期 / 时间：</li>
      </ul>
      <h2>参与人</h2>
      <p></p>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>相关报告：</li>
        <li>相关 memo：</li>
        <li>上一场会议：</li>
      </ul>
      <h2>背景</h2>
      <p></p>
      <h2>讨论要点</h2>
      <ul>
        <li></li>
      </ul>
      <h2>结论 / 决策</h2>
      <ul>
        <li></li>
      </ul>
      <h2>Transcript</h2>
      <p></p>
      <h2>投研影响</h2>
      <ul>
        <li>投资假设影响：</li>
        <li>模型影响：</li>
        <li>关键后续问题：</li>
      </ul>
      <h2>行动项</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
    `,
  },
  {
    title: "会议转录稿",
    description: "原始 transcript、关键表述和待复核片段",
    aliases: [
      "Meeting Transcript",
      "transcript",
      "raw transcript",
      "recording",
      "call transcript",
      "转录稿",
      "会议转录",
      "录音",
      "原始记录",
    ],
    html: `
      <h1>会议转录稿</h1>
      <h2>会议信息</h2>
      <ul>
        <li>主题：</li>
        <li>日期 / 时间：</li>
        <li>平台：</li>
        <li>来源：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>会议纪要：</li>
        <li>公司页面：</li>
        <li>相关报告：</li>
        <li>相关行动项：</li>
      </ul>
      <h2>Transcript</h2>
      <p></p>
      <h2>关键表述</h2>
      <ul>
        <li></li>
      </ul>
      <h2>待复核片段</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
      <h2>投研影响</h2>
      <ul>
        <li>对投资假设的影响：</li>
        <li>对模型的影响：</li>
        <li>需要追问的问题：</li>
      </ul>
    `,
  },
  {
    title: "会议行动项",
    description: "Follow-up、开放问题、负责人和截止日期",
    aliases: [
      "Meeting Action Items",
      "action items",
      "follow-up",
      "follow up",
      "open questions",
      "todo",
      "行动项",
      "开放问题",
      "后续跟踪",
      "待办",
    ],
    html: `
      <h1>会议行动项</h1>
      <h2>关联研究</h2>
      <ul>
        <li>会议纪要：</li>
        <li>Transcript：</li>
        <li>公司页面：</li>
        <li>相关报告：</li>
      </ul>
      <h2>优先级</h2>
      <ul>
        <li>高优先级：</li>
        <li>本周完成：</li>
        <li>等待外部信息：</li>
      </ul>
      <h2>行动项</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>补充公司关联</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>补充相关报告</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>更新投资假设或模型影响</p></div></li>
      </ul>
      <h2>开放问题</h2>
      <ul>
        <li></li>
      </ul>
      <h2>下次跟进</h2>
      <p></p>
    `,
  },
  {
    title: "研究报告",
    description: "报告复盘、核心结论、关联页面和后续工作",
    aliases: [
      "Research Report",
      "report",
      "research report",
      "html report",
      "pdf",
      "file",
      "报告",
    ],
    html: `
      <h1>研究报告</h1>
      <h2>源报告</h2>
      <ul>
        <li>格式：</li>
        <li>来源：</li>
        <li>报告日期：</li>
        <li>本地文件预览：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>相关会议：</li>
        <li>相关 memo：</li>
        <li>相关业绩复盘：</li>
      </ul>
      <h2>核心结论</h2>
      <ul>
        <li></li>
      </ul>
      <h2>投资假设影响</h2>
      <p></p>
      <h2>模型影响</h2>
      <p></p>
      <h2>待解决问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
      <h2>后续行动</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
    `,
  },
  {
    title: "报告摄取清单",
    description: "上传或导入报告后的格式、预览、关联和复核清单",
    aliases: [
      "Report Intake",
      "report intake",
      "file intake",
      "html report",
      "markdown report",
      "pdf report",
      "excel report",
      "word report",
      "native preview",
      "报告摄取",
      "文件摄取",
      "格式复核",
      "原生预览",
    ],
    html: `
      <h1>报告摄取清单</h1>
      <h2>文件信息</h2>
      <ul>
        <li>报告标题：</li>
        <li>格式：HTML / Markdown / PDF / Excel / Word / 其他</li>
        <li>来源：</li>
        <li>报告日期：</li>
        <li>本地文件预览：</li>
      </ul>
      <h2>原生预览状态</h2>
      <table>
        <tbody>
          <tr><th>格式</th><th>当前状态</th><th>可编辑性</th><th>需要人工确认</th></tr>
          <tr><td>HTML</td><td></td><td></td><td></td></tr>
          <tr><td>Markdown</td><td></td><td></td><td></td></tr>
          <tr><td>PDF</td><td></td><td></td><td></td></tr>
          <tr><td>Excel</td><td></td><td></td><td></td></tr>
          <tr><td>Word</td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>核心结论</h2>
      <ul>
        <li></li>
      </ul>
      <h2>数据与图表</h2>
      <ul>
        <li>需要保留的图表：</li>
        <li>需要转成数据库或表格的内容：</li>
        <li>需要复核的数据来源：</li>
      </ul>
      <h2>关联计划</h2>
      <ul>
        <li>公司页面：</li>
        <li>相关会议：</li>
        <li>相关备忘录：</li>
        <li>相关组合或观察名单：</li>
      </ul>
      <h2>格式风险</h2>
      <ul>
        <li>渲染异常：</li>
        <li>表格丢失：</li>
        <li>图片 / 附件缺失：</li>
        <li>需要保留原文件的原因：</li>
      </ul>
      <h2>后续行动</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>确认原生预览是否满足阅读需求</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>补齐公司、会议、备忘录 relation</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>提取需要进入模型或数据库的关键数据</p></div></li>
      </ul>
    `,
  },
  {
    title: "行业对比",
    description: "同业格局、指标对比、赢家路径和反向风险",
    aliases: [
      "Industry Comparison",
      "industry comparison",
      "peer comparison",
      "competitor analysis",
      "sector",
      "peers",
      "行业对比",
      "同业对比",
      "竞品分析",
      "行业研究",
    ],
    html: `
      <h1>行业对比</h1>
      <h2>对比范围</h2>
      <ul>
        <li>行业 / 子行业：</li>
        <li>公司范围：</li>
        <li>时间窗口：</li>
        <li>研究目的：</li>
      </ul>
      <h2>核心结论</h2>
      <p></p>
      <h2>同业指标对比</h2>
      <table>
        <tbody>
          <tr><th>公司</th><th>增长</th><th>利润率</th><th>估值</th><th>竞争优势</th><th>主要风险</th></tr>
          <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>结构性差异</h2>
      <ul>
        <li>商业模式差异：</li>
        <li>客户结构差异：</li>
        <li>成本结构差异：</li>
        <li>资本强度差异：</li>
      </ul>
      <h2>赢家路径</h2>
      <ul>
        <li>最可能胜出的公司：</li>
        <li>关键领先指标：</li>
        <li>需要持续验证的信号：</li>
      </ul>
      <h2>反向风险</h2>
      <ul>
        <li>可能推翻结论的证据：</li>
        <li>周期、监管或技术变化：</li>
        <li>估值误判风险：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>相关报告：</li>
        <li>相关会议：</li>
        <li>关键指标看板：</li>
      </ul>
    `,
  },
  {
    title: "专家电话纪要",
    description: "专家访谈、可信度判断、关键洞见和后续追问",
    aliases: [
      "Expert Call Notes",
      "expert call",
      "expert interview",
      "channel check",
      "interview notes",
      "专家电话",
      "专家访谈",
      "渠道调研",
      "访谈纪要",
    ],
    html: `
      <h1>专家电话纪要</h1>
      <h2>访谈信息</h2>
      <ul>
        <li>主题：</li>
        <li>专家背景：</li>
        <li>日期 / 时间：</li>
        <li>来源 / 平台：</li>
        <li>合规备注：</li>
      </ul>
      <h2>访谈问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
      <h2>核心洞见</h2>
      <ul>
        <li></li>
      </ul>
      <h2>可信度与偏差</h2>
      <table>
        <tbody>
          <tr><th>判断项</th><th>当前判断</th><th>备注</th></tr>
          <tr><td>专家相关性</td><td></td><td></td></tr>
          <tr><td>样本代表性</td><td></td><td></td></tr>
          <tr><td>时间敏感性</td><td></td><td></td></tr>
          <tr><td>潜在偏差</td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>关键表述</h2>
      <blockquote></blockquote>
      <h2>投研影响</h2>
      <ul>
        <li>对投资假设的影响：</li>
        <li>对行业判断的影响：</li>
        <li>对模型或关键指标的影响：</li>
        <li>需要继续验证的问题：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>相关报告：</li>
        <li>会议转录稿：</li>
        <li>会议行动项：</li>
      </ul>
      <h2>后续行动</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>补充反向验证来源</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>更新公司研究或投资备忘录</p></div></li>
      </ul>
    `,
  },
  {
    title: "管理层会议纪要",
    description: "管理层表述、指引变化、资本配置和追问清单",
    aliases: [
      "Management Meeting Notes",
      "management meeting",
      "management call",
      "investor meeting",
      "NDR",
      "管理层会议",
      "管理层电话会",
      "路演",
      "投资者会议",
    ],
    html: `
      <h1>管理层会议纪要</h1>
      <h2>会议信息</h2>
      <ul>
        <li>公司：</li>
        <li>管理层 / IR：</li>
        <li>日期 / 时间：</li>
        <li>会议类型：NDR / 业绩会 / 投资者会议 / 其他</li>
        <li>关联公司页面：</li>
      </ul>
      <h2>会议前假设</h2>
      <ul>
        <li>最想验证的假设：</li>
        <li>最需要追问的风险：</li>
        <li>预期可能改变模型的事项：</li>
      </ul>
      <h2>管理层关键表述</h2>
      <blockquote></blockquote>
      <h2>指引与资本配置</h2>
      <table>
        <tbody>
          <tr><th>主题</th><th>管理层表述</th><th>相对上一版变化</th><th>投研影响</th></tr>
          <tr><td>收入增长</td><td></td><td></td><td></td></tr>
          <tr><td>利润率</td><td></td><td></td><td></td></tr>
          <tr><td>资本开支</td><td></td><td></td><td></td></tr>
          <tr><td>回购 / 分红 / M&amp;A</td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>追问与未回答问题</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p></p></div></li>
      </ul>
      <h2>投研影响</h2>
      <ul>
        <li>投资假设：</li>
        <li>估值假设：</li>
        <li>风险笔记：</li>
        <li>后续催化剂：</li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>投资备忘录：</li>
        <li>业绩复盘：</li>
        <li>估值假设：</li>
        <li>关键指标看板：</li>
      </ul>
    `,
  },
  {
    title: "投研决策日志",
    description: "决策结论、证据链、反向证据和复盘日期",
    aliases: [
      "Research Decision Log",
      "decision log",
      "decision journal",
      "IC memo",
      "thesis update",
      "investment committee",
      "投研决策",
      "决策日志",
      "投委会",
      "结论复盘",
    ],
    html: `
      <h1>投研决策日志</h1>
      <h2>决策摘要</h2>
      <table>
        <tbody>
          <tr><th>项目</th><th>当前结论</th><th>备注</th></tr>
          <tr><td>决策</td><td></td><td></td></tr>
          <tr><td>确信度</td><td></td><td></td></tr>
          <tr><td>组合动作</td><td></td><td></td></tr>
          <tr><td>触发日期</td><td></td><td></td></tr>
          <tr><td>下次复盘日期</td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>证据链</h2>
      <table>
        <tbody>
          <tr><th>证据</th><th>来源</th><th>支持 / 反向</th><th>对结论影响</th></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
          <tr><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>
      <h2>关键假设变动</h2>
      <ul>
        <li>增强的假设：</li>
        <li>削弱的假设：</li>
        <li>新增假设：</li>
        <li>已被证伪的假设：</li>
      </ul>
      <h2>反向证据</h2>
      <ul>
        <li></li>
      </ul>
      <h2>关联研究</h2>
      <ul>
        <li>公司页面：</li>
        <li>投资备忘录：</li>
        <li>估值假设：</li>
        <li>相关报告：</li>
        <li>相关会议：</li>
        <li>组合或观察名单：</li>
      </ul>
      <h2>待确认事项</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>复核证据链是否仍然成立</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>更新相关页面 relation</p></div></li>
      </ul>
    `,
  },
];
