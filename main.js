import * as d3 from 'd3';
import * as d3Sankey from "d3-sankey";

const width = 928;
const height = 600;
const format = d3.format(",.0f");
const linkColor = "source-target"; // source, target, source-target, or a color string.

// Create a SVG container.
const svg = d3.create("svg")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [0, 0, width, height])
  .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

// Constructs and configures a Sankey generator.
const sankey = d3Sankey.sankey()
  .nodeId(d => d.name)
  .nodeAlign(d3Sankey.sankeyJustify) // d3.sankeyLeft, etc.
  .nodeWidth(15)
  .nodePadding(10)
  .extent([[1, 5], [width - 1, height - 5]]);

async function init() {
  const data = await d3.json("data/jmu.json");
  // Applies it to the data. We make a copy of the nodes and links objects
  // so as to avoid mutating the original.

  // -------new code -----------

  const sankeyNodes = [];
  const sankeyLinks = [];
  
  // Create a mapping to track unique nodes and their indices
  const nodeMap = new Map();
  let nodeIndex = 0;

  // Process Revenue Items (leftmost nodes)
  data['jmu-athletics'].forEach(item => {
    const revenueName = item.name;
    if (!nodeMap.has(revenueName)) {
      nodeMap.set(revenueName, nodeIndex++);
      sankeyNodes.push({
        name: nodeMap.get(revenueName),
        title: revenueName,
        category: 0 // Revenue items category
      });
    }
  });

  // Process Revenue Categories (second-to-leftmost nodes)
  const revenueCategories = [...new Set(data['jmu-revenues'].map(r => r.type))];
  revenueCategories.forEach(category => {
    if (!nodeMap.has(category)) {
      nodeMap.set(category, nodeIndex++);
      sankeyNodes.push({
        name: nodeMap.get(category),
        title: category,
        category: 1 // Revenue categories
      });
    }
  });

  // Center node: JMU
  const jmuNodeIndex = nodeIndex++;
  sankeyNodes.push({
    name: jmuNodeIndex,
    title: "JMU",
    category: 2 // Center node
  });

  // Process Expense Categories (second-to-rightmost nodes)
  const expenseCategories = [...new Set(data['jmu-revenues']
    .filter(r => r.type === 'Operating Expense')
    .map(r => 'Operating Expenses'))];
  expenseCategories.forEach(category => {
    if (!nodeMap.has(category)) {
      nodeMap.set(category, nodeIndex++);
      sankeyNodes.push({
        name: nodeMap.get(category),
        title: category,
        category: 3 // Expense categories
      });
    }
  });

  // Process Expense Items (rightmost nodes)
  const expenseItems = data['jmu-revenues']
    .filter(r => r.type === 'Operating Expense');
  expenseItems.forEach(expense => {
    if (!nodeMap.has(expense.name)) {
      nodeMap.set(expense.name, nodeIndex++);
      sankeyNodes.push({
        name: nodeMap.get(expense.name),
        title: expense.name,
        category: 4 // Expense items
      });
    }
  });

  // Create links
  // 1. Revenue Items to Revenue Categories
  data['jmu-athletics'].forEach(item => {
    const revenueItemIndex = nodeMap.get(item.name);
    const revenueCategoryIndex = nodeMap.get('Operating revenues'); // Adjust as needed
    
    sankeyLinks.push({
      source: revenueItemIndex,
      target: revenueCategoryIndex,
      value: Object.values(item)
        .filter(val => typeof val === 'number')
        .reduce((sum, val) => sum + val, 0)
    });
  });

  // 2. Revenue Categories to JMU
  revenueCategories.forEach(category => {
    const categoryIndex = nodeMap.get(category);
    sankeyLinks.push({
      source: categoryIndex,
      target: jmuNodeIndex,
      value: data['jmu-revenues']
        .filter(r => r.type === category)
        .reduce((sum, r) => sum + r['2023'], 0)
    });
  });

  // 3. JMU to Expense Categories
  expenseCategories.forEach(category => {
    sankeyLinks.push({
      source: jmuNodeIndex,
      target: nodeMap.get(category),
      value: data['jmu-revenues']
        .filter(r => r.type === 'Operating Expense')
        .reduce((sum, r) => sum + r['2023'], 0)
    });
  });

  // 4. Expense Categories to Expense Items
  expenseItems.forEach(expense => {
    const expenseCategoryIndex = nodeMap.get('Operating Expenses');
    sankeyLinks.push({
      source: expenseCategoryIndex,
      target: nodeMap.get(expense.name),
      value: expense['2023']
    });
  });

  // Prepare data for Sankey
  const sankeyData = {
    nodes: sankeyNodes,
    links: sankeyLinks
  };


  // ----- original code -------

  const { nodes, links } = sankey({
  // const tmp = sankey({
    nodes: sankeyData.nodes.map(d => Object.assign({}, d)),
    links: sankeyData.links.map(d => Object.assign({}, d))
  });

  // console.log('tmp', tmp);
  console.log('nodes', nodes);
  console.log('links', links);

  // Defines a color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Creates the rects that represent the nodes.
  const rect = svg.append("g")
    .attr("stroke", "#000")
    .selectAll()
    .data(nodes)
    .join("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => color(d.category));

  // Adds a title on the nodes.
  rect.append("title")
    .text(d => {
      console.log('d', d);
      return `${d.name}\n${format(d.value)}`});

  // Creates the paths that represent the links.
  const link = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll()
    .data(links)
    .join("g")
    .style("mix-blend-mode", "multiply");

  // Creates a gradient, if necessary, for the source-target color option.
  if (linkColor === "source-target") {
    const gradient = link.append("linearGradient")
      .attr("id", d => (d.uid = `link-${d.index}`))
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", d => d.source.x1)
      .attr("x2", d => d.target.x0);
    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", d => color(d.source.category));
    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d => color(d.target.category));
  }

  link.append("path")
    .attr("d", d3Sankey.sankeyLinkHorizontal())
    .attr("stroke", linkColor === "source-target" ? (d) => `url(#${d.uid})`
      : linkColor === "source" ? (d) => color(d.source.category)
        : linkColor === "target" ? (d) => color(d.target.category)
          : linkColor)
    .attr("stroke-width", d => Math.max(1, d.width));

  link.append("title")
    .text(d => `${d.source.name} → ${d.target.name}\n${format(d.value)}`);

  // Adds labels on the nodes.
  svg.append("g")
    .selectAll()
    .data(nodes)
    .join("text")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => d.title);

    // Adds labels on the links.
  svg.append("g")
    .selectAll()
    .data(links)
    .join("text")
    .attr("x", d => {
      console.log('linkd', d)
      const midX = (d.source.x1 + d.target.x0) / 2;
      return midX < width / 2 ? midX + 6 : midX - 6
    })
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => {
      console.log('linkd', d);
      return `${d.source.title} → ${d.value} → ${d.target.title}`
    });

  const svgNode = svg.node();
    document.body.appendChild(svgNode);
  return svgNode;
}

init();