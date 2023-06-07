#!/usr/bin/env python3

"""
Run `gradle tiJson assemble` to produce the taskinfo, then run this script to
generate the dependency graphs.
"""

import json
from operator import itemgetter
from pathlib import Path
from typing import Annotated
import pygraphviz as pgv
import typer

GROUP_COLORS={
    '': 'darkred',
    'xproc': 'darkblue',
    'macrogen': 'darkgreen'
}

def is_relevant(dep: dict) -> bool:
    if dep['type'].startswith('org.gradle.execution.plan'):
        return False
    return True

def add_node(graph: pgv.AGraph, node: dict):
    group = node['path'].split(':')[-2]
    graph.add_node(
        node['path'],
        label='<<SUP>{queuePosition}</SUP>{name}>'.format_map(node),
        group=group,
        fontcolor=GROUP_COLORS.get(group, 'black')
    )

def add_deps(graph: pgv.AGraph, node: dict):
    for dep in sorted(node.get('dependencies', []), key=itemgetter('queuePosition')):
        if is_relevant(dep):
            if not dep['path'] in graph:
                add_node(graph, dep)
            graph.add_edge(node['path'], dep['path'])
            add_deps(graph, dep)


def main(input: Annotated[Path, typer.Argument(help="JSON file generated from gradle tiJson <target>")] = Path("../build/taskinfo/taskinfo-assemble.json"),
         output: Annotated[Path, typer.Argument(help="Output .dot file")] = Path('../build/gradle-dependencies.dot'),
         pdf: bool = False,
         svg: bool = False):
    with input.open() as f:
        deptree = json.load(f)
    graph = pgv.AGraph(directed=True, rankdir="RL", ordering="out", ranksep="0.2", page="11.7 8.3")
    graph.node_attr.update(shape='plain')
    graph.edge_attr.update(color='gray')
    add_deps(graph, deptree)
    graph.write(output)
    if pdf:
        graph.draw(output.with_suffix('.pdf'), prog='dot')
    if svg:
        graph.draw(output.with_suffix('.svg'), prog='dot')


if __name__ == "__main__":
    typer.run(main)
