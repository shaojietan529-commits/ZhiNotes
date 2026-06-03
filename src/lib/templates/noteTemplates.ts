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
];
